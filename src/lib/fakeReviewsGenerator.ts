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

/** Câu review chung (generic) theo từng mức sao — phong cách 7x/8x, có viết tắt và sai chính tả nhẹ. */
const TEMPLATES: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  5: [
    'Sp đẹp wá, shop tư vấn nhiệt tình',
    'Hàng ngon, giao nhanh trong ngày luôn',
    'Chất lg ok, giá tốt hơn nhiều shop khác',
    'Mua xog ưng cái bụng lắmm',
    'Nv tư vấn dễ thg, sẽ ủng hộ tiếp',
    'Ship hàng nhanh, đóng gói cẩn thận lắm',
    'Lần 2 mua r, vẫn ok như lần đầu',
    'Giá hợp lý, sp đúng mô tả',
    'Shop uy tín nhé mn, ai cần cứ ghé',
    'Đk bảo hành đầy đủ, tư vấn tận tâm',
    'Sp đẹp k tì vết, cảm ơn shop',
    'Giao đúng hẹn, hàng chuẩn mô tả',
    'Quá ưng luôn, recommend cho ae',
    'Shop ok, sản phẩm ok, giá ok',
    'Mua cho con dùg, nó thích lắmm',
    'Mua tặg vợ, vợ khen quá trời',
    'Sp xịn, k chê đk điểm nào',
    'Đáng đồng tiền, sẽ ủng hộ shop dài dài',
    'Lần đầu mua online mà ưng ghê',
    'Shop hỗ trợ tận tình từ A-Z',
    'Hàg về tay rất hài lòng nhé',
    'Đáng đồng tiền bát gạo lắm',
    'Tin tưởng shop, sẽ giới thiệu bạn bè',
  ],
  4: [
    'Ổn áp, chỉ tội giao hơi lâu xíu',
    'Sp ok, hộp hơi cũ tí nhưg ko sao',
    'Hài lòg, chỉ là chất lg tạm đk thôi',
    'Sp tốt, giá nên giảm thêm chút nữa',
    'Tư vấn nhiệt tình, sp dùng ổn',
    'Mua ok, có chút trầy nhẹ ở viền',
    'Hàng đúng mô tả, ship hơi chậm',
    'Tổng thể hài lòng, sẽ quay lại',
    'Dùng ổn, chỉ là đóng gói hơi sơ',
    'Đk, nhưg mong shop kiểm hàng kỹ hơn',
    'Ok mn ạ, mua ko tệ',
    'Sp ổn, đóg gói có thể chắc hơn',
    'Nv ok, giao đúng hẹn',
    'Hàg về dùng tạm ổn, chấp nhận đk',
    'Mua đk, nhưng test mất hơi lâu',
    'Giá hơi cao chút mà chất lg ổn',
    'Đáp ứng nhu cầu, tổng thể hài lòng',
    'Sp đẹp, chất lg chưa thật xuất sắc',
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
    'Hơi thất vọng, sp có chút lỗi nhỏ',
    'Chất lg yếu, mong shop đổi giúp',
    'Hàg ko như mong đợi, cảm thấy hụt hẫg',
    'Tư vấn 1 đg giao 1 nẻo',
    'Vỏ hộp móp, sp có vết xước nhỏ',
    'Ship chậm, gọi shop hơi khó liên lạc',
    'Sp ko đúg ảnh lắm, hơi buồn',
    'Sp lỗi vặt, mong khắc phục',
    'Ko hài lòng nhưg lười đổi trả',
    'Giá này mà chất lg vầy thì hơi tiếc',
    'Mua xog hối hận, k giốg mô tả',
    'Dvu chưa tốt, sp tạm bợ',
    'Mong shop chú ý chất lg hơn nha',
    'Hộp đb sơ sài, k có phụ kiện kèm',
    'Hàng có vấn đề, mất công đổi trả',
  ],
  1: [
    'Quá tệ, sp lỗi ngay khi mở hộp',
    'Tư vấn 1 đg, giao 1 nẻo, ko ưg',
    'Ship chậm cả tuần, gọi ko ai bắt máy',
    'Sp ko như quảng cáo, thất vọng',
    'Sp bị lỗi, shop chối quanh',
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

/**
 * Template chuyên ngành — chỉ chứa câu ĐẶC TRƯNG cho danh mục đó.
 * Khi sản phẩm match category, ta MIX 60% câu chuyên ngành + 40% câu generic.
 */
type Category =
  | 'phone' | 'charger' | 'laptop' | 'headphone' | 'watch'
  | 'camera' | 'fashion' | 'cosmetic' | 'food' | 'home'
  | 'tablet' | 'gaming' | 'generic';

const CATEGORY_TEMPLATES: Record<Exclude<Category, 'generic'>, Record<1 | 2 | 3 | 4 | 5, string[]>> = {
  phone: {
    5: [
      'Máy đẹp như mới, pin trâu, đáng tiền',
      'Chụp ảnh nét căng, màu lên xuất sắc',
      'Máy mượt mà, chiến game ko lag',
      'Pin dùng cả ngày k hết, quá đỉnh',
      'Test máy kỹ trc khi giao, yên tâm',
      'Màn hình đẹp, loa to rõ',
      'Cấu hình ngon, đa nhiệm mượt',
      'Cảm ứng nhạy, vân tay nhanh',
      'Pin trâu thật sự, sạc nhanh nữa',
      'Máy zin, k bung sửa, ưng quá',
    ],
    4: [
      'Máy ok, pin tạm đủ dùng cả ngày',
      'Cam chụp ổn, thiếu sáng hơi noise',
      'Mượt mà, chỉ là pin chai 1 chút',
      'Máy đẹp, viền có vết nhẹ thôi',
      'Loa hơi rè khi mở max, còn lại ok',
    ],
    3: [
      'Máy chạy đk, pin tụt nhanh hơn nghĩ',
      'Cam tạm, ko nét bằng quảng cáo',
      'Bt thôi, dùng đk nhưng k đặc sắc',
    ],
    2: [
      'Pin tụt nhanh, máy nóng khi chơi game',
      'Máy chạy lag, app bị giật',
      'Cam mờ, ko như ảnh shop đăng',
    ],
    1: [
      'Máy lỗi nguồn ngay tuần đầu',
      'Pin chai nặng, sạc 2 tiếng đk 50%',
      'Cam hỏng, loa rè, quá tệ',
    ],
  },
  charger: {
    5: [
      'Sạc nhanh thật, đầy pin trong 1 tiếng',
      'Cáp chắc chắn, đầu cắm khít',
      'Dùng cho iphone sạc nhanh ầm ầm',
      'Cáp dài dùng tiện, k bị nóng',
      'Cốc nhỏ gọn, công suất chuẩn',
      'Sạc nhanh, k bị tụt khi cắm vừa dùng',
      'Bọc dây bền, kéo căng k đứt',
      'Đầu type-c chuẩn, cắm chắc',
    ],
    4: [
      'Sạc ok, đầu cắm hơi rộng tí',
      'Cáp tạm bền, dùng đk vài tháng',
      'Tốc độ sạc đk, ko nhanh như qcáo',
    ],
    3: [
      'Bình thg, sạc tốc độ tạm đk',
      'Cáp dùng đk, ko nổi bật',
    ],
    2: [
      'Sạc chậm, nóng cốc khi cắm lâu',
      'Dây bị đứt sau 2 tuần dùng',
    ],
    1: [
      'Sạc 1 tuần là hỏng, ko nhận máy',
      'Cốc cháy luôn, suýt cháy ổ điện',
    ],
  },
  laptop: {
    5: [
      'Máy chạy mượt, mở app nhanh, đáng tiền',
      'Bàn phím gõ êm, màn hình đẹp',
      'Pin trâu, dùng cả buổi k cần sạc',
      'Cấu hình mạnh, chiến game tốt',
      'Máy mỏng nhẹ, mang đi học tiện',
      'Tản nhiệt ổn, k bị nóng khi render',
    ],
    4: [
      'Máy ok, quạt hơi ồn khi load nặng',
      'Pin tạm đk, dùng 5-6 tiếng',
      'Màn hình đẹp, viền hơi dày tí',
    ],
    3: [
      'Bt, chạy đk văn phòng, game thì hơi đuối',
      'Máy tạm, pin chai sẵn',
    ],
    2: [
      'Máy lag khi mở nhiều tab',
      'Bàn phím kẹt phím sau 1 tuần',
    ],
    1: [
      'Máy hỏng nguồn, ko boot đk',
      'Quạt kêu rè rè, sửa hoài k hết',
    ],
  },
  headphone: {
    5: [
      'Âm thanh trong, bass chắc, treble sáng',
      'Đeo êm tai, ko đau khi dùng lâu',
      'Chống ồn tốt, đi tàu xe vẫn yên tĩnh',
      'Pin trâu, sạc nhanh, kết nối ổn định',
      'Mic gọi rõ, ngta nghe k bị rè',
      'Bluetooth bắt nhanh, k delay',
    ],
    4: [
      'Âm ok, bass hơi nhiều với ngta',
      'Đeo lâu hơi mỏi tai chút',
      'Pin tạm đk, sạc hơi lâu',
    ],
    3: [
      'Bt, âm thanh tạm, k ấn tượng',
      'Đeo tạm, ko qá êm',
    ],
    2: [
      'Mic rè, gọi điện ngta nghe ko rõ',
      'Pin tụt nhanh, dùng 2h hết',
    ],
    1: [
      'Tai nghe 1 bên, ko ra tiếng',
      'Bluetooth rớt liên tục, ko dùng đk',
    ],
  },
  watch: {
    5: [
      'Đồng hồ đẹp, đeo lên sang hẳn',
      'Pin trâu, đo nhịp tim chuẩn',
      'Mặt sắc nét, cảm ứng nhạy',
      'Đeo nhẹ tay, k vướg víu',
      'Theo dõi sức khỏe rất chi tiết',
    ],
    4: [
      'Đồng hồ ok, dây hơi cứng tí',
      'Pin tạm 1 ngày, sạc nhanh',
    ],
    3: ['Bt, đo nhịp tim chưa thật chuẩn'],
    2: ['Pin tụt nhanh, dùng nửa ngày hết'],
    1: ['Đồng hồ chết máy sau 1 tuần'],
  },
  camera: {
    5: [
      'Ảnh ra nét căng, màu lên xuất sắc',
      'Quay 4k mượt, chống rung tốt',
      'Lens nét, bokeh mịn màng',
      'Cấu hình ngon, lấy nét nhanh',
    ],
    4: ['Máy ok, chỉ là body hơi nặng', 'Lens nét, hơi đắt chút'],
    3: ['Bt, ảnh ra tạm đk'],
    2: ['Lấy nét chậm, ảnh hay bị mờ'],
    1: ['Máy lỗi cảm biến, ảnh đầy noise'],
  },
  fashion: {
    5: [
      'Áo đẹp, vải mát, mặc lên xinh wá',
      'Form chuẩn người, đg sz luôn',
      'Vải đẹp, k nhăn, giặt k phai màu',
      'Mặc lên sang, đg ảnh shop',
      'Đường may đẹp, ko bị lỗi chỉ',
      'Chất vải mềm mịn, mặc thoải mái',
      'Màu lên đẹp như hình, ưng quá',
    ],
    4: [
      'Áo ok, hơi rộng 1 chút so vs sz',
      'Vải đẹp, mặc hơi nóng tí',
      'Form đẹp, màu hơi khác ảnh chút',
    ],
    3: [
      'Bt, vải tạm, mặc đk',
      'Form ok, may chưa thật khéo',
    ],
    2: [
      'Vải mỏng, nhìn xuyên thấu',
      'Đg may bị lỗi, chỉ thừa nhiều',
    ],
    1: [
      'Áo rách sau 1 lần giặt',
      'Vải bèo, ko giốg ảnh tí nào',
    ],
  },
  cosmetic: {
    5: [
      'Dùng xog da mịn hẳn, ưng ghê',
      'Mùi thơm dễ chịu, k bí da',
      'Lên màu đẹp, lâu trôi',
      'Hợp da nhạy cảm, k bị kích ứng',
      'Dưỡng da căng bóng sau 1 tuần',
      'Hàg auth, có tem chống giả',
    ],
    4: [
      'Sp ok, mùi hơi nồng tí',
      'Lên màu đẹp, hơi khô môi nhẹ',
    ],
    3: ['Bt, dùng đk nhưg chưa thấy hiệu quả'],
    2: ['Da bị nổi mẩn nhẹ sau khi dùng', 'Mùi hắc, khó chịu'],
    1: ['Da nổi mụn nhiều sau 2 ngày dùng', 'Nghi hàg fake, k giốg auth'],
  },
  food: {
    5: [
      'Ăn ngon, đậm đà đúng vị',
      'Tươi ngon, đóg gói cẩn thận',
      'Vị chuẩn, ăn 1 lần là nghiện',
      'Giao nhanh, hàng còn nóg',
      'Hương vị đậm đà, ăn k ngán',
      'Sạch sẽ, nguyên liệu tươi',
    ],
    4: ['Ngon, hơi ngọt 1 chút với mình', 'Vị ổn, phần hơi ít'],
    3: ['Bt, ăn đk 1 lần thôi'],
    2: ['Hơi nhạt, k đậm vị như mong đợi', 'Đóg gói sơ, đồ bị xê dịch'],
    1: ['Đồ ăn ôi, mở ra mùi hôi', 'Hàg hết hạn, ko dám ăn'],
  },
  home: {
    5: [
      'Đồ chắc chắn, lắp dễ, dùng bền',
      'Thiết kế đẹp, hợp nhà mình',
      'Chất liệu xịn, đáng đồng tiền',
      'Vận hành êm, k ồn',
      'Tiết kiệm điện, mát nhanh',
    ],
    4: ['Ok, lắp hơi mất time tí', 'Đồ đẹp, hộp móp nhẹ'],
    3: ['Bt, dùng đk, k nổi bật'],
    2: ['Vận hành ồn, hơi rung lắc'],
    1: ['Hàng hỏng sau 1 tuần dùng'],
  },
  tablet: {
    5: [
      'Màn đẹp, chiến game mượt',
      'Pin trâu, xem phim cả ngày',
      'Bút viết mượt, học online tiện',
      'Loa to rõ, xem netflix đỉnh',
    ],
    4: ['Máy ok, hơi nặng tay khi cầm lâu'],
    3: ['Bt, dùng đk lướt web đọc báo'],
    2: ['Pin tụt nhanh hơn nghĩ'],
    1: ['Màn hình lỗi điểm chết'],
  },
  gaming: {
    5: [
      'Chiến game mượt, fps cao ổn định',
      'Tay cầm chắc, nút nhấn nhạy',
      'Phản hồi nhanh, k delay',
      'Đeo lâu k mỏi, đáng tiền',
    ],
    4: ['Ok, dây hơi ngắn 1 chút'],
    3: ['Bt, xài tạm đk'],
    2: ['Nút bấm kẹt sau 1 tuần'],
    1: ['Hỏng sau vài ngày dùng'],
  },
};

/** Phát hiện danh mục dựa trên tên sản phẩm. */
function detectCategory(productName: string): Category {
  const n = (productName || '').toLowerCase();
  if (!n.trim()) return 'generic';

  // Sạc/cáp
  if (/(c[aá]p|cable|s[aạ]c nhanh|c[uủ] s[aạ]c|c[oố]c s[aạ]c|adapter|charger|sac\b|pin d[uự] ph[oò]ng|powerbank|power bank)/i.test(n)) return 'charger';
  // Tai nghe
  if (/(tai nghe|headphone|earbud|airpod|earphone|headset|buds)/i.test(n)) return 'headphone';
  // Đồng hồ
  if (/(đ[oồ]ng h[oồ]|watch|smartwatch|apple watch|garmin)/i.test(n)) return 'watch';
  // Laptop
  if (/(laptop|macbook|notebook|ultrabook|surface|asus|dell|hp |lenovo|acer)/i.test(n)) return 'laptop';
  // Tablet
  if (/(ipad|tablet|m[aá]y t[ií]nh b[aả]ng|galaxy tab)/i.test(n)) return 'tablet';
  // Camera
  if (/(camera|m[aá]y [aả]nh|dslr|mirrorless|gopro|sony alpha|canon eos|nikon)/i.test(n)) return 'camera';
  // Gaming
  if (/(chu[oộ]t game|b[aà]n ph[ií]m|gaming|tay c[aầ]m|joystick|controller|playstation|ps5|xbox|nintendo)/i.test(n)) return 'gaming';
  // Phone (sau cùng để charger ko bị nuốt) — iphone, samsung, xiaomi, oppo...
  if (/(iphone|ip\s?\d|samsung|galaxy s|galaxy a|galaxy z|xiaomi|redmi|oppo|vivo|realme|huawei|nokia|m[aá]y(?!\s+ảnh)|phone|đi[eệ]n tho[aạ]i|smartphone|pixel)/i.test(n)) return 'phone';
  // Mỹ phẩm / skincare
  if (/(son|kem |serum|m[aặ]t n[aạ]|sữa r[uử]a|toner|mascara|ph[aấ]n|makeup|m[yỹ] ph[aẩ]m|cosmetic|n[uư][oớ]c hoa|perfume|l[oó]t|d[uưỡ]ng da|skincare|b[oộ] s[aả]n ph[aẩ]m d[uưỡ]ng)/i.test(n)) return 'cosmetic';
  // Thực phẩm
  if (/(b[aá]nh|k[eẹ]o|tr[aà] |c[aà] ph[eê]|coffee|sữa\b|đ[oồ] [aă]n|th[uự]c ph[aẩ]m|snack|đ[oồ] u[oố]ng|food|drink|n[uư][oớ]c |gia v[iị]|n[uư][oớ]c m[aắ]m|h[aả]i s[aả]n)/i.test(n)) return 'food';
  // Thời trang
  if (/(áo|qu[aầ]n|v[aá]y|đ[aầ]m |gi[aà]y |d[eé]p|t[uú]i x[aá]ch|n[oó]n|m[uũ] |b[aó]p |b[oộ] đ[oồ]|t-shirt|shirt|jeans|hoodie|jacket|sneaker)/i.test(n)) return 'fashion';
  // Đồ gia dụng
  if (/(qu[aạ]t|đ[eè]n |n[oồ]i |ch[aả]o|m[aá]y l[oọ]c|m[aá]y x[aă]y|m[aá]y gi[aặ]t|t[uủ] l[aạ]nh|đi[eề]u h[oò]a|m[aá]y h[uú]t b[uụ]i|gia d[uụ]ng|kitchen|home appliance|n[oồ]i c[oơ]m)/i.test(n)) return 'home';

  return 'generic';
}

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

/** Sinh nội dung 1 review theo mức sao + danh mục, có thể thêm tên sản phẩm (~30%) và emoji (~10%). */
function generateContent(
  rating: 1 | 2 | 3 | 4 | 5,
  productName: string,
  category: Category,
  rand: () => number,
): string {
  const generic = TEMPLATES[rating];
  const specific = category !== 'generic' ? CATEGORY_TEMPLATES[category]?.[rating] || [] : [];
  // 65% dùng câu chuyên ngành nếu có; còn lại dùng câu generic
  const useSpecific = specific.length > 0 && rand() < 0.65;
  const list = useSpecific ? specific : generic;
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
  const category = detectCategory(productName);
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
        content: generateContent(s, productName, category, rand),
        rating: s,
      });
    }
  }

  return result;
}