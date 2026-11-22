# ADR-001: Chuyển đổi mô hình trạng thái Đèn Lồng & Điều kiện thắng (Phase 3)

## Bối cảnh & Thay đổi (Ticket-03)
- **Luật cũ bị thay thế:** Đèn sau khi thắp sáng tồn tại vĩnh viễn và người chơi thắng ngay khi thắp đủ 100% số đèn.
- **Thiết kế mới:**
  1. **Nhiên liệu đèn (Fuel):** Lưu dưới dạng số nguyên `fuelTicks` (tối đa `6000` tương đương `100.0` đơn vị) để tránh sai số dấu phẩy động, chỉ chia `60` và làm tròn 1 chữ số thập phân khi xuất snapshot.
  2. **Hao hụt & Hút dầu:** Đèn sáng tự giảm `1` tick dầu mỗi tick (`1/60` mỗi giây). Bóng Mực ở trạng thái `wander` ưu tiên tìm đèn sáng có `fuel < 30` gần nhất, lại gần `<= 2m` sẽ chuyển sang `drain` và hút thêm `5` tick dầu/tick (cộng dồn nhiều con).
  3. **Tắt đèn & Thắp lại:** Khi `fuel <= 0`, đèn tắt (`lit = false`, `ever_lit = true`), phát sự kiện `lantern_out`. Thắp lại đèn đã từng sáng chỉ tốn `5` đom đóm thay vì `10`.
  4. **Điều kiện thắng mới:** Bỏ thắng sớm (`all_lit`). Chỉ thắng khi hết thời gian Đêm (240s / 270s / 300s) mà người chơi còn sống và số đèn đang sáng `>= ceil(0.6 * tổng_đèn)` (`dawn_survived`).

## Breaking Changes đối với Test cũ
- `all_lit` không còn tồn tại; các test cũ kỳ vọng thắng ngay khi đèn sáng phải chuyển sang kiểm tra `lantern_lit` hoặc chạy tới hết giờ để nhận `dawn_survived`.
- Công thức tính điểm cũ (`+10/mote`, `+100/lantern`, thưởng thời gian) bị thay thế hoàn toàn bởi công thức mới (`+5/mote`, `+100` thắp mới, `+40` thắp lại, `+15` khi pulse Bóng Mực đang `drain`).