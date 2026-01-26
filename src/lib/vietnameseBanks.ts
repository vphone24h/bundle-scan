// Danh sách ngân hàng Việt Nam theo chuẩn VietQR
// https://api.vietqr.io/v2/banks

export interface VietnameseBank {
  code: string;      // Mã ngắn (VCB, TCB...)
  name: string;      // Tên hiển thị
  bin: string;       // Bank Identification Number
  shortName?: string; // Tên viết tắt
}

export const VIETNAMESE_BANKS: VietnameseBank[] = [
  { code: 'VCB', name: 'Vietcombank', bin: '970436', shortName: 'VCB' },
  { code: 'TCB', name: 'Techcombank', bin: '970407', shortName: 'TCB' },
  { code: 'MB', name: 'MB Bank', bin: '970422', shortName: 'MB' },
  { code: 'ACB', name: 'ACB', bin: '970416', shortName: 'ACB' },
  { code: 'VPB', name: 'VPBank', bin: '970432', shortName: 'VPB' },
  { code: 'TPB', name: 'TPBank', bin: '970423', shortName: 'TPB' },
  { code: 'STB', name: 'Sacombank', bin: '970403', shortName: 'STB' },
  { code: 'HDB', name: 'HDBank', bin: '970437', shortName: 'HDB' },
  { code: 'VIB', name: 'VIB', bin: '970441', shortName: 'VIB' },
  { code: 'SHB', name: 'SHB', bin: '970443', shortName: 'SHB' },
  { code: 'EIB', name: 'Eximbank', bin: '970431', shortName: 'EIB' },
  { code: 'MSB', name: 'MSB', bin: '970426', shortName: 'MSB' },
  { code: 'OCB', name: 'OCB', bin: '970448', shortName: 'OCB' },
  { code: 'LPB', name: 'LienVietPostBank', bin: '970449', shortName: 'LPB' },
  { code: 'BIDV', name: 'BIDV', bin: '970418', shortName: 'BIDV' },
  { code: 'VBA', name: 'Agribank', bin: '970405', shortName: 'VBA' },
  { code: 'ICB', name: 'VietinBank', bin: '970415', shortName: 'CTG' },
  { code: 'NAB', name: 'Nam A Bank', bin: '970428', shortName: 'NAB' },
  { code: 'SCB', name: 'SCB', bin: '970429', shortName: 'SCB' },
  { code: 'NCB', name: 'NCB', bin: '970419', shortName: 'NCB' },
  { code: 'SGB', name: 'Saigonbank', bin: '970400', shortName: 'SGB' },
  { code: 'BAB', name: 'Bac A Bank', bin: '970409', shortName: 'BAB' },
  { code: 'PVCB', name: 'PVcomBank', bin: '970412', shortName: 'PVCB' },
  { code: 'OJB', name: 'OceanBank', bin: '970414', shortName: 'OJB' },
  { code: 'GPB', name: 'GPBank', bin: '970408', shortName: 'GPB' },
  { code: 'VAB', name: 'VietABank', bin: '970427', shortName: 'VAB' },
  { code: 'SEAB', name: 'SeABank', bin: '970440', shortName: 'SEAB' },
  { code: 'COOPBANK', name: 'Co-opBank', bin: '970446', shortName: 'COOPBANK' },
  { code: 'KLB', name: 'Kienlongbank', bin: '970452', shortName: 'KLB' },
  { code: 'BVB', name: 'Viet Capital Bank', bin: '970454', shortName: 'BVB' },
  { code: 'WOO', name: 'Woori Bank', bin: '970457', shortName: 'WOO' },
  { code: 'VRB', name: 'VRB', bin: '970421', shortName: 'VRB' },
  { code: 'UOB', name: 'UOB Vietnam', bin: '970458', shortName: 'UOB' },
  { code: 'SCVN', name: 'Standard Chartered VN', bin: '970410', shortName: 'SCVN' },
  { code: 'PBVN', name: 'Public Bank Vietnam', bin: '970439', shortName: 'PBVN' },
  { code: 'NHB', name: 'Nonghyup Bank', bin: '970456', shortName: 'NHB' },
  { code: 'IVB', name: 'Indovina Bank', bin: '970434', shortName: 'IVB' },
  { code: 'IBK', name: 'IBK HCM', bin: '970455', shortName: 'IBK' },
  { code: 'HSBC', name: 'HSBC Vietnam', bin: '458761', shortName: 'HSBC' },
  { code: 'HLBVN', name: 'Hong Leong Bank VN', bin: '970442', shortName: 'HLBVN' },
  { code: 'SHBVN', name: 'Shinhan Bank VN', bin: '970424', shortName: 'SHBVN' },
  { code: 'CIMB', name: 'CIMB Vietnam', bin: '422589', shortName: 'CIMB' },
  { code: 'CAKE', name: 'CAKE by VPBank', bin: '546034', shortName: 'CAKE' },
  { code: 'UBANK', name: 'Ubank by VPBank', bin: '546035', shortName: 'UBANK' },
  { code: 'TIMO', name: 'Timo by Bản Việt', bin: '963388', shortName: 'TIMO' },
  { code: 'VTLMONEY', name: 'ViettelMoney', bin: '971005', shortName: 'VTLMONEY' },
  { code: 'VNPTMONEY', name: 'VNPT Money', bin: '971011', shortName: 'VNPTMONEY' },
  { code: 'ABB', name: 'ABBank', bin: '970425', shortName: 'ABB' },
  { code: 'BVBANK', name: 'BaoVietBank', bin: '970438', shortName: 'BVBANK' },
].sort((a, b) => a.name.localeCompare(b.name));

// Tạo mapping từ tên ngân hàng -> mã VietQR
const bankCodeMap: Record<string, string> = {};
VIETNAMESE_BANKS.forEach(bank => {
  bankCodeMap[bank.name] = bank.code;
  bankCodeMap[bank.code] = bank.code;
  if (bank.shortName) {
    bankCodeMap[bank.shortName] = bank.code;
  }
});

/**
 * Lấy mã VietQR từ tên ngân hàng
 * @param bankName Tên ngân hàng (có thể là tên đầy đủ hoặc mã ngắn)
 * @returns Mã VietQR hoặc null nếu không tìm thấy
 */
export function getBankCode(bankName: string): string | null {
  if (!bankName) return null;
  
  // Tìm chính xác
  if (bankCodeMap[bankName]) {
    return bankCodeMap[bankName];
  }
  
  // Tìm gần đúng (không phân biệt hoa thường)
  const normalizedName = bankName.toLowerCase().trim();
  const bank = VIETNAMESE_BANKS.find(b => 
    b.name.toLowerCase() === normalizedName ||
    b.code.toLowerCase() === normalizedName ||
    (b.shortName && b.shortName.toLowerCase() === normalizedName)
  );
  
  return bank?.code || null;
}

/**
 * Tạo URL QR VietQR
 * @param bankCode Mã ngân hàng VietQR
 * @param accountNumber Số tài khoản
 * @param amount Số tiền (VND)
 * @param content Nội dung chuyển khoản
 * @param accountName Tên chủ tài khoản
 * @returns URL ảnh QR
 */
export function generateVietQRUrl(
  bankCode: string,
  accountNumber: string,
  amount: number,
  content: string,
  accountName?: string
): string {
  const cleanAccountNo = accountNumber.replace(/\s/g, '');
  const template = 'compact2';
  
  let url = `https://img.vietqr.io/image/${bankCode}-${cleanAccountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
  
  if (accountName) {
    url += `&accountName=${encodeURIComponent(accountName)}`;
  }
  
  return url;
}
