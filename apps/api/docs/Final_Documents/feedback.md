# ROLE

Bạn là một Principal Software Architect, Principal Business Analyst, Technical Writer và Software Engineering Reviewer.

Bạn có kinh nghiệm xây dựng:

- BRD
- SRS
- ASR
- ADD
- ADR
- SAD
- Enterprise Architecture Documentation
- Graduation Thesis Report
- Capstone Project Report

Ngoài vai trò viết báo cáo, bạn còn đóng vai trò reviewer kỹ thuật có nhiệm vụ kiểm tra tính nhất quán, tính đầy đủ và chất lượng học thuật của tài liệu.

---

# GOAL

Refactor trực tiếp file:

```text
@DA1_report.md
```

KHÔNG tạo file mới.

Mục tiêu:

- Nâng chất lượng báo cáo lên mức đồ án/capstone chuyên nghiệp.
- Đạt quy mô khoảng 100–120 trang.
- Đảm bảo báo cáo có thể được đọc độc lập.
- Giữ nhất quán với toàn bộ hệ thống tài liệu và source code.
- Thể hiện đầy đủ chiều sâu phân tích nghiệp vụ, kiến trúc và kỹ thuật.

---

# MANDATORY READING PHASE

Trước khi sửa báo cáo, phải đọc và phân tích lại toàn bộ các nguồn sau.

## 1. Báo cáo hiện tại

Đọc toàn bộ:

```text
@DA1_report.md
```

Mục tiêu:

- Hiểu cấu trúc hiện tại.
- Xác định các phần cần refactor.
- Xác định nội dung nào đã tốt và nên giữ lại.
- Xác định nội dung nào cần mở rộng.

---

## 2. Template báo cáo

Đọc:

```text
@NoiDung Bao Cao Đồ án 1,2.md
```

Mục tiêu:

- Đảm bảo không lệch yêu cầu của môn học.

---

## 3. Tài liệu nghiệp vụ

Đọc toàn bộ:

```text
@Food_Delivery_Vision_and_Scope.md

@BRD.md

@Business_Rules.md
```

---

## 4. Tài liệu yêu cầu

Đọc toàn bộ:

```text
@SRS_FoodDelivery.md

@USE_CASE_SPECIFICATION.md

@User_Stories_and_Acceptance_Criteria.md
```

---

## 5. Tài liệu mô hình hóa

Đọc:

```text
@SRS_SequenceDiagrams.md
```

---

## 6. Tài liệu chất lượng

Đọc:

```text
@Utility_Tree.md

@14 Quality Attribute.md

```

---

## 7. Tài liệu kiến trúc

Đọc toàn bộ:

```text
@ASR_FoodDelivery.md

@ADD_FoodDelivery.md

@ADR_FoodDelivery.md

@SAD_FoodDelivery.md

@CD_GUIDE.md
```

---

## 8. Tài liệu AI

Đọc:

```text
@Proposal_Multimodel.md
```

---

## 9. SOURCE CODE ANALYSIS (BẮT BUỘC)

Không được bỏ qua bước này.

Phải duyệt toàn bộ codebase.

Phân tích:

### Kiến trúc

- modules
- bounded contexts
- layers
- dependencies

### Database

- schema
- migrations
- relationships
- entities

### API

- endpoints
- controllers
- services

### Authentication

### Payment

### Notifications

### Reviews

### Promotion

### AI Integration (nếu có)

### Folder Structure

### Test Structure

### DevOps

### Observability

### Validation

### Documentation

---

# SOURCE OF TRUTH PRIORITY

## Ưu tiên tài liệu

Các nội dung sau phải lấy từ tài liệu:

```text
Business Objectives

Success Metrics

Business Rules

ASR

ADR

Use Cases

Quality Attributes
```

---

## Ưu tiên source code

Các nội dung sau phải lấy từ @codebase:

```text
Tech Stack

Database Schema

Folder Structure

Implemented Features

Test Suites

API Design

UI hiện có
```

---

# REFACTOR REQUIREMENTS

Thực hiện toàn bộ các thay đổi dưới đây.

---

# 1. CHƯƠNG 1

## Giảm cảm giác Technical Specification

Không đi quá sâu vào:

- internal states
- idempotency
- implementation details

Các nội dung kỹ thuật sâu nên chuyển xuống Chương 3.

---

## Mở rộng mục 1.4.4

Không chỉ:

```text
Performance

Availability

Reliability

Security

Scalability
```

Mà phải trình bày đầy đủ các Quality Attributes đã phân tích trong ADD_FoodDelivery.md.

Bao gồm:

- Performance
- Availability
- Reliability
- Security
- Scalability
- Modifiability
- Observability
- Maintainability

và các quality goals liên quan.

---

# 2. CHƯƠNG 2

## Rà soát lại toàn bộ Tech Stack

Phân tích codebase.

Kiểm tra xem còn thiếu:

### Observability

Ví dụ:

- OpenTelemetry
- Prometheus
- Grafana
- Winston
- Pino

### Testing

- Jest
- Supertest

### DevOps

- Docker
- GitHub Actions
- GHCR

### API Documentation

- Swagger/OpenAPI

### Validation

- Zod
- class-validator

hoặc bất kỳ công nghệ nào khác xuất hiện trong source code.

Nếu có phải bổ sung vào Chương 2.

---

## Phần công nghệ

Giữ format:

```text
Giới thiệu

Ưu điểm

Nhược điểm

Lý do lựa chọn
```

---

### Lưu ý cực kỳ quan trọng

KHÔNG viết:

```text
Source code xác nhận...

ASR yêu cầu...

ADR quyết định...
```

---

Thay vào đó:

Giải thích:

- tại sao công nghệ phù hợp với bài toán
- lợi ích công nghệ mang lại
- giá trị công nghệ tạo ra cho hệ thống

---

## Phần AI

Không được đi thẳng vào:

```text
ConvNeXt

XLM-RoBERTa

Fusion Layer
```

---

Bổ sung trước:

### Bài toán

### Động lực áp dụng AI

### Hạn chế của ảnh đơn lẻ

### Hạn chế của văn bản đơn lẻ

### Lý do cần Multimodal AI

Flow:

```text
Business Problem
↓
AI Problem
↓
Multimodal Solution
↓
ConvNeXt
↓
XLM-RoBERTa
↓
Fusion Layer
↓
Explainable AI
↓
AI Agent
```

---

# 3. CHƯƠNG 3.1

## Chèn hình kiến trúc

Bắt buộc sử dụng hình từ:

```text
ADD_FoodDelivery.md

SAD_FoodDelivery.md
```

Không tự vẽ lại.

---

Phải có:

### 3.1.1 Logical View

### 3.1.2 Runtime View

### 3.1.3 Implementation View

### 3.1.4 Data View

### 3.1.5 Deployment View

Mỗi mục:

- chèn hình
- giải thích

---

# 4. CHƯƠNG 3.1.6

Bổ sung:

```text
3.1.6 Architectural Decisions
```

Bao gồm:

```text
ADR-001 — Adopt Modular Monolith Architecture

ADR-003 — Use Database per BC Ownership

ADR-004 — Use In-process EventBus Communication

ADR-005 — Adopt ACL Snapshot Pattern

ADR-006 — Use Redis Runtime Layer

ADR-007 — Use Ports and Adapters Integration Pattern

ADR-008 — Adopt Drizzle Type-safe Persistence Layer
```

---

## Format ADR

Giữ nguyên tinh thần của ADR_FoodDelivery.md.

KHÔNG được bỏ các phần:

### Bối cảnh

### Các phương án được xem xét

### So sánh và đánh đổi

### Quyết định

### Lý do lựa chọn

### Tác động

---

Viết ngắn gọn hơn ADR gốc.

Không copy nguyên ADR.

---

# 5. CHƯƠNG 3.2

Nguồn duy nhất:

```text
USE_CASE_SPECIFICATION.md
```

---

KHÔNG:

- Rewrite
- Tóm tắt
- Rút gọn
- Diễn giải

---

Mỗi UC Domain phải giữ nguyên bảng đặc tả.

Bao gồm:

```text
Use Case ID

Use Case Name

Actors

Description

Preconditions

Postconditions

Priority

Frequency of Use

Normal Course of Events

Alternative Courses

Exceptions

Includes

Extends

Special Requirements

Assumptions

Notes & Issues
```

---

Giữ nguyên cấu trúc bảng như USE_CASE_SPECIFICATION.md.

---

# 6. CHƯƠNG 3.3

Refactor hoàn toàn.

---

## 3.3.1 ERD tổng thể

- Chèn ERD
- Giải thích

---

## 3.3.2 Auth BC Data Model

## 3.3.3 Restaurant Catalog BC Data Model

## 3.3.4 Ordering BC Data Model

## 3.3.5 Payment BC Data Model

## 3.3.6 Promotion BC Data Model

## 3.3.7 Notification BC Data Model

## 3.3.8 Review BC Data Model

---

Mỗi BC phải gồm:

### Mô tả BC

### Danh sách bảng

### Data Dictionary

### Quan hệ

### Ý nghĩa nghiệp vụ

---

Không chỉ trình bày vài bảng tiêu biểu.

Phải trình bày toàn bộ bảng thuộc BC đó.

---

# 7. CHƯƠNG 4

Mở rộng phần kiểm thử.

---

### 4.3.1 Testing Strategy

- Testing Pyramid
- Testing Scope

---

### 4.3.2 Unit Testing

- Framework
- Structure
- Example Tests
- Coverage (nếu có)

---

### 4.3.3 Integration Testing

- API Integration
- Database Integration

---

### 4.3.4 End-to-End Testing

Ví dụ:

```text
Login
↓
Add Cart
↓
Checkout
↓
Payment
↓
Tracking
```

---

### 4.3.5 Non-functional Testing

- Performance
- Reliability
- Security
- Availability

---

Nếu codebase có:

```text
Jest

Supertest

e2e

test suites
```

thì phải đưa vào báo cáo.

---

# WRITING RULES

## Không được viết

```text
Theo ASR...

Theo ADR...

Theo ADD...

Theo BR-4...

Theo Utility Tree...

Source code xác nhận...
```

---

## Không được viết như tài liệu traceability

---

## Phải viết như một báo cáo học thuật độc lập

---

## Văn phong

- Chuyên nghiệp
- Học thuật
- Chỉnh chu
- Dễ đọc
- Phù hợp báo cáo tốt nghiệp

---

# MANDATORY REVIEW PHASE

Sau khi hoàn thành việc refactor DA1_report.md.

KHÔNG được xuất kết quả ngay.

Phải review tối thiểu 3 vòng.

---

## Review Pass 1 — Consistency Review

Kiểm tra:

- Có còn trace tài liệu không.
- Có còn văn phong kiểu ASR/SAD không.
- Có phần nào mâu thuẫn với docs không.

Nếu có:

Sửa ngay.

---

## Review Pass 2 — Completeness Review

Kiểm tra:

- Có thiếu chương nào không.
- Có thiếu ADR nào không.
- Có thiếu hình nào không.
- Có thiếu bảng Use Case nào không.
- Có thiếu BC Data Model nào không.
- Có thiếu công nghệ nào từ codebase không.
- Có thiếu phần testing không.

Nếu có:

Bổ sung ngay.

---

## Review Pass 3 — Quality Review

Kiểm tra:

- Văn phong học thuật.
- Chính tả.
- Thuật ngữ.
- Định dạng Markdown.
- Tính mạch lạc.
- Chất lượng trình bày.

Nếu phát hiện điểm chưa hợp lý:

Sửa ngay.

---

# OUTPUT

Chỉnh sửa trực tiếp:

```text
DA1_report.md
```

Không tạo file mới.

Không xuất reasoning.

Không xuất checklist.

Không xuất review notes.

Chỉ giữ lại phiên bản cuối cùng của:

```text
DA1_report.md
```

sau khi đã hoàn thành toàn bộ quá trình review và chỉnh sửa.
