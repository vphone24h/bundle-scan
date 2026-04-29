/**
 * Sinh review ảo cho landing product KHÔNG dùng AI.
 * - Ngân hàng tên Việt thật (đa dạng).
 * - Ngân hàng câu theo từng mức sao, phong cách 7x/8x: viết tắt, sai chính tả nhẹ, không sến.
 * - Tự tránh trùng tên với danh sách đã có.
 */

const FIRST_NAMES = [
  'An','Anh','Bảo','Bằng','Bích','Châu','Chi','Cường','Dũng','Duy','Đạt','Đông','Giang','Hà','Hải','Hằng','Hạnh','Hiếu','Hiền','Hòa','Hoàng','Hồng','Huy','Huyền','Hùng','Hưng','Khánh','Khoa','Khôi','Kiên','Kiều','Lan','Linh','Loan','Long','Mai','Minh','My','Nam','Nga','Ngân','Ngọc','Nhân','Nhi','Như','Oanh','Phong','Phú','Phúc','Phương','Quân','Quang','Quỳnh','Sơn','Tâm','Thảo','Thắng','Thành','Thanh','Thịnh','Thu','Thúy','Thủy','Tiến','Tín','Toàn','Trang','Trí','Trinh','Tú','Tuấn','Tùng','Tường','Uyên','Vinh','Vy','Yến','Bình','Đức','Hậu','Lâm','Nghĩa','Nhật','Phát','Tài','Thắm','Thiện','Thúy','Trân','Vân'
];

const LAST_NAMES = [
  'Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đào','Đoàn','Trịnh','Tô','Mai','Vương','Cao','Lương','La','Quách'
];

const NICKNAME_PREFIXES = ['Anh','Chị','Bé','Cô','Chú','Em'];
const NICKNAME_SUFFIXES = ['Bống','Bí','Mèo','Mít','Su','Bin','Bo','Tép','Cún','Tũn','Min','Moon','Bơ','Sữa','Heo'];

/** Câu review theo từng mức sao — phong cách 7x/8x, có viết tắt và sai chính tả nhẹ. */
const TEMPLATES: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  5: [
    'Máy đẹp wá, shop tư vấn nhiệt tình',
    'Hàng ngon, giao nhanh trong ngày luôn',
    'Chất lg ok, giá tốt hơn nhiều shop khác',
    'Mua xog ưng cái bụng lắmm',
    'Nv tư vấn dễ thg, sẽ ủng hộ tiếp',
    'Máy như mới, pin trâu, đáng tiền',
    'Ship hàng nhanh, đóng gói cẩn thận lắm',
    'Lần 2 mua r, vẫn ok như lần đầu',
    'Giá hợp lý, máy chạy mượt mà',
    'Test máy kỹ trc khi giao, yên tâm',
    'Shop uy tín nhé mn, ai cần cứ ghé',
    'Đk bảo hành đầy đủ, tư vấn tận tâm',
    'Máy đẹp k tì vết, cảm ơn shop',
    'Giao đúng hẹn, máy chuẩn mô tả',
    'Quá ưng luôn, recommend cho ae',
    'Shop ok, sản phẩm ok, giá ok',
    'Mua cho con dùg, nó thích lắmm',
    'Mua tặg vợ, vợ khen quá trời',
    'Sp xịn, k chê đk điểm nào',
    'Mượt mà, chụp ảnh đẹp, đáng đồng tiền',
    'Lần đầu mua online mà ưng ghê',
    'Shop hỗ trợ tận tình từ A-Z',
    'Hàg về tay rất hài lòng nhé',
    'Đáng đồng tiền bát gạo lắm',
    'Tin tưởng shop, sẽ giới thiệu bạn bè',
  ],
  4: [
    'Ổn áp, chỉ tội giao hơi lâu xíu',
    'Máy ok, hộp hơi cũ tí nhưg ko sao',
    'Hài lòg, chỉ là pin tạm đk thôi',
    'Sp tốt, giá nên giảm thêm chút nữa',
    'Tư vấn nhiệt tình, máy dùng ổn',
    'Mua ok, có chút trầy nhẹ ở viền',
    'Hàng đúng mô tả, ship hơi chậm',
    'Tổng thể hài lòng, sẽ quay lại',
    'Máy chạy mượt, chỉ là sạc hơi yếu',
    'Đk, nhưg mong shop kiểm hàng kỹ hơn',
    'Ok mn ạ, mua ko tệ',
    'Sp ổn, đóg gói có thể chắc hơn',
    'Nv ok, giao đúng hẹn',
    'Hàg về dùng tạm ổn, chấp nhận đk',
    'Mua đk, nhưng test mất hơi lâu',
    'Giá hơi cao chút mà chất lg ổn',
    'Đáp ứng nhu cầu, tổng thể hài lòng',
    'Máy đẹp, pin chưa trâu lắm',
    'Shop nhiệt tình, sp tạm đk',
    'Ok, sẽ giới thiệu bạn nếu cần',
  ],
  3: [
    'Tạm đk, k có gì nổi bật',
    'Bình thg, đúg như giá tiền',
    'Sp ổn, dịch vụ có thể tốt hơn',
    'Hàng giao chậm, máy thì cug đk',
    'Mua xog cũg ko ưg lắm nhưg dùg đk',
    'Tạm chấp nhận, mong shop cải thiện',
    'Máy đk thôi, k qá xuất sắc',
    'Bt mn ạ, ai cần thì cân nhắc',
    'Giao hơi lâu, máy ổn',
    'K xuất sắc nhưg cũng k tệ',
    'Sp đáp ứng cơ bản, k có gì hơn',
    'Tư vấn hơi qua loa, hàng tạm',
    'Cug đk, mua lần đầu thôi',
    'Bình thg, ko khen ko chê',
    'Tầm tiền này thì tạm chấp nhận đk',
  ],
  2: [
    'Hơi thất vọng, máy có chút lỗi nhỏ',
    'Pin tụt nhanh, mong shop đổi giúp',
    'Hàg ko như mong đợi, cảm thấy hụt hẫg',
    'Tư vấn 1 đg giao 1 nẻo',
    'Vỏ hộp móp, máy có vết xước nhỏ',
    'Ship chậm, gọi shop hơi khó liên lạc',
    'Sp ko đúg ảnh lắm, hơi buồn',
    'Máy chạy lag, mong khắc phục',
    'Ko hài lòng nhưg lười đổi trả',
    'Giá này mà chất lg vầy thì hơi tiếc',
    'Mua xog hối hận, k giốg mô tả',
    'Dvu chưa tốt, sp tạm bợ',
    'Mong shop chú ý chất lg hơn nha',
    'Hộp đb sơ sài, k có phụ kiện kèm',
    'Hàng có vấn đề, mất công đổi trả',
  ],
  1: [
    'Quá tệ, máy lỗi ngay khi mở hộp',
    'Tư vấn 1 đg, giao 1 nẻo, ko ưg',
    'Ship chậm cả tuần, gọi ko ai bắt máy',
    'Sp ko như quảng cáo, thất vọng',
    'Máy bị lỗi, shop chối quanh',
    'Mất tiền oan, ko bao giờ quay lại',
    'Hàg về hỏng luôn, gọi đổi rất khó',
    'Dịch vụ kém, mn cân nhắc',
    'Ko hỗ trợ bảo hành như đã hứa',
    'Trải nghiệm tệ nhất từ trc đến nay',
    'Đề nghị shop xem lại quy trìh',
    'Ko đáng tin, mn cẩn thận',
    'Hàg dởm, ship chậm, dvu kém',
    'Mua xog hối hận tột cùng',
    'Shop trốn tránh trách nhiệm',
  ],
};

/** Một số emoji nhẹ ngẫu nhiên cho ~10% review. */
const EMOJIS = ['😍','👍','❤️','🥰','✨','😊','😅','😢','😡','🙏'];

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Sinh 1 tên ngẫu nhiên — đa dạng kiểu (tên ngắn, họ tên đầy đủ, nickname). */
function generateName(rand: () => number): string {
  const style = rand();
  if (style < 0.45) {
    // Họ + Tên
    return `${pick(LAST_NAMES, rand)} ${pick(FIRST_NAMES, rand)}`;
  }
  if (style < 0.75) {
    // Chỉ tên
    return pick(FIRST_NAMES, rand);
  }
  if (style < 0.9) {
    // Tên + họ ngược
    return `${pick(FIRST_NAMES, rand)} ${pick(LAST_NAMES, rand)}`;
  }
  // Nickname
  return `${pick(NICKNAME_PREFIXES, rand)} ${pick(NICKNAME_SUFFIXES, rand)}`;
}

/** Sinh nội dung 1 review theo mức sao, có thể thêm tên sản phẩm (~30%) và emoji (~10%). */
function generateContent(rating: 1 | 2 | 3 | 4 | 5, productName: string, rand: () => number): string {
  const list = TEMPLATES[rating];
  let text = pick(list, rand);
  // 30% có nhắc tên sp ngắn
  if (productName && rand() < 0.3) {
    const shortName = productName.split(/\s+/).slice(0, 3).join(' ');
    if (rand() < 0.5) text = `${shortName} ${text.toLowerCase()}`;
    else text = `${text}, ${shortName} ngon nha`;
  }
  // 10% emoji
  if (rand() < 0.1) text = `${text} ${pick(EMOJIS, rand)}`;
  return text;
}

/** Tạo SĐT VN ngẫu nhiên hợp lệ. */
export function generateFakePhone(): string {
  const prefixes = ['090','091','093','094','096','097','098','081','082','083','084','085','086','088','089','070','076','077','078','079'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const rest = String(Math.floor(1000000 + Math.random() * 9000000));
  return p + rest;
}

export interface FakeReviewItem {
  customer_name: string;
  customer_phone: string;
  content: string;
  rating: number;
}

/**
 * Sinh danh sách review ảo theo phân bổ sao.
 * Tự tránh trùng tên với `existingNames` và trong batch.
 */
export function generateFakeReviews(opts: {
  productName: string;
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
  existingNames?: string[];
}): FakeReviewItem[] {
  const { productName, counts } = opts;
  const rand = Math.random;
  const used = new Set<string>(
    (opts.existingNames || []).map(n => n.trim().toLowerCase())
  );

  const result: FakeReviewItem[] = [];
  const stars: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1];

  for (const s of stars) {
    const n = Math.max(0, Math.min(50, Number(counts[s]) || 0));
    for (let i = 0; i < n; i++) {
      // Tên không trùng — thử tối đa 30 lần, không thì append số
      let name = generateName(rand);
      let key = name.toLowerCase();
      let attempts = 0;
      while (used.has(key) && attempts < 30) {
        name = generateName(rand);
        key = name.toLowerCase();
        attempts++;
      }
      if (used.has(key)) {
        let suffix = 2;
        while (used.has(`${key} ${suffix}`)) suffix++;
        name = `${name} ${suffix}`;
        key = name.toLowerCase();
      }
      used.add(key);

      result.push({
        customer_name: name,
        customer_phone: generateFakePhone(),
        content: generateContent(s, productName, rand),
        rating: s,
      });
    }
  }

  return result;
}