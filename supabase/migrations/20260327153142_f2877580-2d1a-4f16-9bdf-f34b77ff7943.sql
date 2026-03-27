
-- ==========================================
-- FIX 1: chat_messages - fix self-referential bug
-- ==========================================
DROP POLICY IF EXISTS "Members can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Members can send messages" ON chat_messages;

CREATE POLICY "Members can view messages"
ON chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = chat_messages.conversation_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send messages"
ON chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = chat_messages.conversation_id
    AND cm.user_id = auth.uid()
  )
);

-- ==========================================
-- FIX 2: conversation_members - fix self-referential bug
-- ==========================================
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can add to own conversations" ON conversation_members;

CREATE POLICY "Members can view conversation members"
ON conversation_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm2
    WHERE cm2.conversation_id = conversation_members.conversation_id
    AND cm2.user_id = auth.uid()
  )
);

CREATE POLICY "Members can add to own conversations"
ON conversation_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- ==========================================
-- FIX 3: conversations - fix broken cm.id reference
-- ==========================================
DROP POLICY IF EXISTS "Members can view conversations" ON conversations;

CREATE POLICY "Members can view conversations"
ON conversations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversations.id
    AND cm.user_id = auth.uid()
  )
);

-- ==========================================
-- FIX 4: security_passwords - restrict to super_admin only
-- ==========================================
DROP POLICY IF EXISTS "Users can read own tenant security password" ON security_passwords;
DROP POLICY IF EXISTS "Super admins can manage security password" ON security_passwords;

-- Only super_admin can read (not all tenant members)
CREATE POLICY "Super admins can read security password"
ON security_passwords FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = security_passwords.tenant_id
    AND ur.user_role = 'super_admin'
  )
);

-- Only super_admin can manage (insert/update/delete)
CREATE POLICY "Super admins can manage security password"
ON security_passwords FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = security_passwords.tenant_id
    AND ur.user_role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = security_passwords.tenant_id
    AND ur.user_role = 'super_admin'
  )
);
