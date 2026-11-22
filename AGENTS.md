# Hướng dẫn cho AI Agent - Dự án Đảo Đèn Lồng

## Lệnh hệ thống
- Cài đặt: `npm install`
- Chạy game 3D: `npm run dev`
- Chạy headless: `node src/headless.js`
- Chạy kiểm thử: `npm test`

## Quy tắc kiến trúc bắt buộc
1. **Tách biệt tuyệt đối:** Thư mục `src/core/` KHÔNG ĐƯỢC phép import `three`, `window`, `document` hay bất kỳ thư viện đồ họa nào. Toàn bộ logic chạy ở tần số cố định 60 tick/giây (`dt = 1/60`).
2. **Tính tất định (Determinism):** Mọi yếu tố ngẫu nhiên phải dùng PRNG theo `--seed` truyền vào, tuyệt đối không dùng `Math.random()`.
3. **Trung thực kiểm thử:** Không bao giờ viết test giả hoặc hardcode kết quả cho pass. Khi sửa luật ở phase sau, cập nhật test cũ và ghi rõ lý do.
4. **Bảo mật & Sáng tạo:** Không tạo/commit file `.env`. Mọi tính năng sáng tạo thêm phải đặt cờ tắt mặc định khi chạy chế độ `--headless`.
5. **Thứ tự xử lý tick (Contract v1.1):** Luôn tuân thủ đúng 12 bước trong 1 tick: Input/Pause -> Giảm bộ đếm -> Di chuyển Mây (Lướt/Bục nhảy/Gió) -> Nhặt đom đóm & Bùa -> Nạp đèn -> Vùng an toàn -> Tỏa Sáng -> Di chuyển Bóng Mực & Gió Lạc -> Va chạm (Gió Lạc cướp trước, Bóng Mực đánh sau) -> Sinh thực thể -> Xét thắng/thua -> Snapshot.
6. **Đa màn chơi & Hiệu năng:** Khi chuyển Đêm (1, 2, 3), phải reset sạch danh sách thực thể và bộ nhớ. Chế độ headless 21.600 tick phải hoàn thành dưới 30 giây.