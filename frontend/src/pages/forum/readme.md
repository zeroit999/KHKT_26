 🧪 Testing Outline

# 📌 1. Đã Test (Completed)

### 👥 Thành viên & Phân quyền

* [x] khi thành viên bị kick thì sẽ tự động out khỏi nhóm và không còn trong nhóm
* [x] trong phần list thành viên sẽ chia ra hai phần: 1) thành viên 2) quản trị viên(người tạo kênh)
* [x] người tạo kênh có quyền them một người bất kì trong nhóm làm quản trị viên của kênh đó và sẽ có panel là “phó nhóm”, người tạo ra kênh là “trưởng nhóm”. Chức năng của từng chức vụ:

* [x] trưởng nhóm: có toàn quyền quyết định
* [x] phó nhóm: chỉ có khả năng kick thành viên và duyệt thành viên
* [x] người tạo kênh (trưởng nhóm) trước khi muốn rời nhóm phải chuyển nhượng chức trưởng nhóm cho một người bất kì trong nhóm
* [x] tạo thêm nút logo danh sách có chức năng duyệt thành viên khi nhóm chọn duyệt thành viên, hãy tự thêm logic cho tôi
* [x] setting (admin có thêm lựa chọn duyệt thành viên/ người dùng bình thường chỉ thấy được: tổng quan/cấu hình nhóm/kênh/quyền thành viên/mời bạn bè (có nghĩa là không cho người dùng xem: duyệt/giới hạn thành viên/giao diện/dữ liệu hệ thống))

### 🔒 Quyền riêng tư & Tham gia nhóm

* [x] khi người dùng nhập đúng mã mời mà nhóm đó đã vượt quá thành viên hoặc không vô được thì người đó sẽ không vô được và hiện pop-up thông báo lý do
* [x] chức năng "không công khai" là một chức năng con của riêng tư và chỉ qua lời mời (là một option)
* [x] logic: khi nhóm chọn "không công khai" thì nhóm đó sẽ không được hiển thị trên đại sảnh, chỉ khi nhập đúng mã nhóm thì mới hiện ra. khi chọn chức năng không công khai kế bên panel ban đầu (riêng tư/chỉ qua lời mời) sẽ có panel là không công khai. Lưu ý: admin_dev có khả năng nhìn thấy tất cả kể cả nhóm không công khai. Người tạo ra nhóm đó cũng sẽ thấy nhóm đó kể cả là không công khai
* [x] nếu vô rồi thì nhóm ko công khai thì cũng hiện
* [x] logic thời gian mã mời: giả sử chọn 1 ngày thì hết 1 ngày mã mời sẽ đổi một cái ngẫu nhiên khác
* [x] Trong phần setting của kênh chính hoặc setting nhóm, tài khoản trưởng nhóm cần có thêm chức năng "Duyệt thành viên" nằm trong cấu hình nhóm 

### ⚙️ Cài đặt & Tạo nhóm

* [x] hãy đồng bộ chức năng của setting với các chức năng có trong tạo nhóm mới
* [x] logic: ban đầu sẽ hiện màu theo người dùng chọn khi nhập link ảnh vô rồi thì mới đổi thành ảnh link đó
* [x] ở phần lớp học tối thiểu để tham gia hãy để dạng dropdown (lớp 10,lớp 11, lớp 12, giáo viên, không)
* [x] logic: khi người dùng chọn lớp 10 trong "lớp học tối thiểu" thì phải từ lớp 10 đổ lên thì mới được tham gia tương tự với lớp 11,lớp 12, giáo viên và không. cấp bậc xét như sau : lớp 10<lớp 11<lớp 12<giáo viên<không
* [x] phần thêm kênh tuỳ chỉnh : chia ra hai ngăn một bên là icon gồm các icon có sẵn và icon # , một bên là nhập tên. logic: cái nào bắt buộc cũng có # đứng trước khi nhập xong, ví dụ: tôi chọn icon #, tên Nam thì kết quả ra là #(icon:#)Nam
* [x] khi tạo xong nhóm thì sẽ hiện ra pop-up thông báo thành công "Tạo thành công" với nút copy mã nhóm, copy mã mời, và nút "Vào nhóm ngay" (logic tự thêm)

### 🎨 Giao diện (UI/UX)
* [x] làm gọn cái thanh emotion của chat

* [x] hiện tại tôi cần fix lỗi gradient: khi chọn gradient rồi mà cái ô vuông nhỏ nhỏ không thay đổi (ví dụ ở ảnh 2) và bên ngoài ở các thẻ nhóm học của không hiện (ví dụ ảnh 3).
* [x] fix màu
* [x] thanh sidebar di chuyển liên tục
* [x] nút báo cáo nhóm nằm trong nhóm kế răng cưa setting
* [x] trong kênh chat chính thì khi ấn dấu cộng thì nó xoay 45 độ và hiện ra ba mục (hình ảnh/file/thông báo)

### 💬 Nhóm học & Kênh

* [x] rời nhóm sẽ đưa thông báo lên chat
* [x] cho ghim nhóm học (tối đa 3 nhóm)
* [x] sort nhóm học (đã tham gia/ tất cả)
* [x] zoom ảnh khi click và có nút tải khi zoom
* [x] tài liệu khi click vào sẽ mở pop-up lịch sử tài liệu ra (hiện tối đa 5 nếu muốn hiện thêm thì qua page tiếp theo)
* [x] thông báo là bài viết

### 🚨 Báo cáo & Quản trị

* [x] làm thêm nút báo cáo nhóm (có sẵn list mặc định). logic: những nhóm đã báo cáo, quản trị viên được quyền tham gia nhóm (bỏ qua logic giới hạn thành viên, mật khẩu hay mã mời). khi bị báo cáo nhóm đó sẽ có kí hiệu đỏ báo cáo chỉ admin thấy và gửi thông báo cho admin
* [x] nút xóa nhóm(admin) có list lí do sẵn
* [x] quản lý bài viết -> quản lý (thêm sort và chức năng quản lý nhóm học)
* [x] bài viết nào bị báo cáo thì gửi thông báo cho admin
* [x] chỉ khi được cảnh báo thì admin mới được vô nhóm
* [x] tạo thêm nút đã giải quyết trong quản lý nhóm -> báo cáo nhóm
* [x] sau khi viết cảnh báo xong hoặc ấn nút đã giải quyết thì admin sẽ bị out khỏi nhóm đó và cảnh báo sẽ mất
* [x] khi admin nhận báo cáo thì thẻ nhóm có hai nút là admin vào và tham gia (tôi cần xóa nút tham gia)
### 📢 Sự kiện & Thông báo

* [x] khi sự kiện tới lúc mở thì sẽ hiện thông báo cho mọi người

### 🧹 Khác

* [x] xóa đóng góp nổi bật

---
# 🔄 2. Đang Test (In Progress)

### 👮 Quản trị & Báo cáo

### 💬 Kênh chat


---
> [!IMPORTANT]
# ❌ 3. Test Thất Bại / Bug

* [ ] mời bằng ID user
* [ ] sửa size web
* [ ] nhóm học có chức năng tắt thông báo

---
> [!NOTE]
# 💡 4. Ý Tưởng / Ghi Chú









***mẫu:
VIẾT LẠI MỘT PROMPT CHÍNH XÁC CÓ THỂ VIẾT DƯỚI DẠNG MARKDOWN VỀ ĐOẠN PROMPT NÀY CỦA TÔI ĐỂ CHO ai CÓ THỂ DỄ HIỂU NHẤT CÓ THỂ:



Gửi lại full file đã sửa. cho tôi full code của những file phải chỉnh sửa(lưu ý:không thay đổi những thứ không liên quan trong những điều tôi kêu), những file không liên quan thì không thay đổi thứ gì




















