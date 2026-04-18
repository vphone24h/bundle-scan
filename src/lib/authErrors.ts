/**
 * Translate Supabase auth error messages to Vietnamese.
 * Centralized so all auth surfaces show consistent, friendly messages.
 */
export function translateAuthError(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  const msg = (error as any)?.message || (typeof error === 'string' ? error : '') || '';
  if (!msg) return fallback;
  const m = msg.toLowerCase();

  // Password strength / leaked
  if (/pwned|leaked|known to be|easy to guess|weak/i.test(m)) {
    return 'Mật khẩu này đã bị lộ trong các vụ rò rỉ dữ liệu hoặc quá yếu. Vui lòng chọn mật khẩu mạnh hơn (kết hợp chữ hoa, chữ thường, số, ký tự đặc biệt).';
  }
  if (/should be different|same as the old|new password should be different/i.test(m)) {
    return 'Mật khẩu mới phải khác mật khẩu cũ.';
  }
  if (/password.*(short|length)|at least 6|minimum.*character/i.test(m)) {
    return 'Mật khẩu quá ngắn. Vui lòng nhập ít nhất 6 ký tự.';
  }

  // Login
  if (/invalid login credentials|invalid email or password/i.test(m)) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (/email not confirmed/i.test(m)) {
    return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản.';
  }
  if (/user not found/i.test(m)) {
    return 'Không tìm thấy tài khoản với email này.';
  }
  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(m)) {
    return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi vài phút rồi thử lại.';
  }
  if (/rate limit|too many requests/i.test(m)) {
    return 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ít phút.';
  }

  // Signup
  if (/user already registered|already exists|already been registered/i.test(m)) {
    return 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.';
  }
  if (/signup.*disabled|signups not allowed/i.test(m)) {
    return 'Tính năng đăng ký hiện đang bị tắt.';
  }
  if (/invalid email|valid email/i.test(m)) {
    return 'Địa chỉ email không hợp lệ.';
  }

  // Session / token
  if (/auth session missing|session.*not found|jwt expired|invalid jwt|invalid refresh token|refresh token not found/i.test(m)) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (/token.*expired|otp.*expired|expired/i.test(m)) {
    return 'Mã/đường dẫn đã hết hạn. Vui lòng yêu cầu lại.';
  }
  if (/invalid.*token|invalid otp|token.*invalid/i.test(m)) {
    return 'Mã xác thực không đúng hoặc đã hết hạn.';
  }

  // Network
  if (/network|failed to fetch|fetch failed/i.test(m)) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
  }

  return msg || fallback;
}
