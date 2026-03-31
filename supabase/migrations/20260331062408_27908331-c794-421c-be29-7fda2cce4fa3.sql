-- Fix orphan cash_book entry: reassign from deleted branch to current Quận 9 branch
UPDATE cash_book 
SET branch_id = 'b81c949b-b89f-4091-b7b1-fefe811e9794'
WHERE id = 'b17f3270-1724-4089-bfdf-c747d7625313'
AND branch_id = '5da310cf-11c4-47c6-896a-3a43fbd17cd6';

-- Fix any other orphan entries generically
UPDATE cash_book cb
SET branch_id = correct_branch.correct_branch_id
FROM (
  SELECT cb2.id as cash_book_id, 
         valid_b.id as correct_branch_id
  FROM cash_book cb2
  JOIN branches orphan_b ON cb2.branch_id = orphan_b.id AND orphan_b.tenant_id IS NULL
  JOIN branches valid_b ON valid_b.name = orphan_b.name AND valid_b.tenant_id = cb2.tenant_id
) correct_branch
WHERE cb.id = correct_branch.cash_book_id
AND cb.branch_id != correct_branch.correct_branch_id;