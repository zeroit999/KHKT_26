import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const initialForm = {
  title: '',
  topic: '',
  teacherCode: '',
  description: '',
  visibility: 'public',
  className: '',
  openAt: '',
  thumbnailFileName: '',
  thumbnailPreview: '',
  thumbnailFile: null,
  attachMode: 'youtube',
  youtubeUrl: '',
  fileName: '',
  filePreviewUrl: '',
  fileType: '',
  file: null,
  documentFileName: '',
  documentPreviewUrl: '',
  documentFileType: '',
  documentFile: null,
  codeLanguage: 'javascript',
  codeContent: '',
  documentContent: '',
  lessons: [
    {
      title: 'Bài 1',
      content: '',
      attachMode: 'youtube',
      youtubeUrl: '',
      fileName: '',
      filePreviewUrl: '',
      fileType: '',
      file: null,
      documentFileName: '',
      documentPreviewUrl: '',
      documentFileType: '',
      documentFile: null,
      codeLanguage: 'javascript',
      codeContent: '',
      documentContent: '',
    },
  ],
}

function ELearningCreateModal({
  open,
  onClose,
  isDarkMode,
  teacherProfile,
  teacherClasses = [],
  loadingClasses = false,
  currentUser = null,
  onCreated,
}) {
  const [form, setForm] = useState(initialForm)
  const [activeStep, setActiveStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const latestFormRef = useRef(form)
  const contentScrollRef = useRef(null)
  const sectionOneRef = useRef(null)
  const sectionTwoRef = useRef(null)
  const sectionThreeRef = useRef(null)
  const sectionFourRef = useRef(null)
  const lessonEndRef = useRef(null)

  const fixedTeacherSubject = getTeacherSubject(teacherProfile)
  const teacherName = getTeacherName(teacherProfile)

  const eLearningCodePreview = useMemo(() => {
    const subjectCode = getSubjectCode(fixedTeacherSubject)
    const teacherInitials = getTeacherInitials(teacherName)
    const safeTeacherCode = String(form.teacherCode || '0000')
      .replace(/\D/g, '')
      .slice(0, 4)
      .padEnd(4, '0')

    return `${teacherInitials}_${subjectCode}_${safeTeacherCode}`
  }, [fixedTeacherSubject, teacherName, form.teacherCode])

  useEffect(() => {
    latestFormRef.current = form
  }, [form])

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    return () => {
      const latestForm = latestFormRef.current

      revokeIfBlob(latestForm.thumbnailPreview)
      revokeIfBlob(latestForm.filePreviewUrl)
      revokeIfBlob(latestForm.documentPreviewUrl)

      latestForm.lessons.forEach((lesson) => {
        revokeIfBlob(lesson.filePreviewUrl)
        revokeIfBlob(lesson.documentPreviewUrl)
      })
    }
  }, [])

  if (!open) return null

  function getSectionRef(step) {
    if (step === 1) return sectionOneRef
    if (step === 2) return sectionTwoRef
    if (step === 3) return sectionThreeRef
    return sectionFourRef
  }

  function scrollToSection(step) {
    setActiveStep(step)

    const container = contentScrollRef.current
    const target = getSectionRef(step).current

    if (!container || !target) return

    const containerTop = container.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    const currentScrollTop = container.scrollTop

    container.scrollTo({
      top: currentScrollTop + targetTop - containerTop - 16,
      behavior: 'smooth',
    })
  }

  function handleContentScroll() {
    const container = contentScrollRef.current
    if (!container) return

    const sectionList = [
      { step: 1, ref: sectionOneRef },
      { step: 2, ref: sectionTwoRef },
      { step: 3, ref: sectionThreeRef },
      { step: 4, ref: sectionFourRef },
    ]

    const scrollBottom = container.scrollTop + container.clientHeight
    const nearBottom = scrollBottom >= container.scrollHeight - 16

    if (nearBottom) {
      setActiveStep(4)
      return
    }

    const containerTop = container.getBoundingClientRect().top
    const offset = Math.min(220, container.clientHeight * 0.38)

    let currentStep = 1

    sectionList.forEach((section) => {
      const element = section.ref.current
      if (!element) return

      const sectionTop = element.getBoundingClientRect().top - containerTop

      if (sectionTop <= offset) {
        currentStep = section.step
      }
    })

    setActiveStep(currentStep)
  }

  function updateForm(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function updateTeacherCode(value) {
    updateForm('teacherCode', value.replace(/\D/g, '').slice(0, 4))
  }

  function updateVisibility(value) {
    setForm((prev) => ({
      ...prev,
      visibility: value,
      className: value === 'public' ? '' : prev.className,
    }))
  }

  function handleThumbnailChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)

    setForm((prev) => {
      revokeIfBlob(prev.thumbnailPreview)

      return {
        ...prev,
        thumbnailFileName: file.name,
        thumbnailPreview: previewUrl,
        thumbnailFile: file,
      }
    })

    event.target.value = ''
  }

  function removeThumbnail() {
    setForm((prev) => {
      revokeIfBlob(prev.thumbnailPreview)

      return {
        ...prev,
        thumbnailFileName: '',
        thumbnailPreview: '',
        thumbnailFile: null,
      }
    })
  }

  function handleMainFileChange(nameKey, previewKey, typeKey, event) {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    const fileKey = resolveFileStateKey(nameKey)

    setForm((prev) => {
      revokeIfBlob(prev[previewKey])

      return {
        ...prev,
        [nameKey]: file.name,
        [previewKey]: previewUrl,
        [typeKey]: file.type || '',
        [fileKey]: file,
      }
    })

    event.target.value = ''
  }

  function addLesson() {
    setForm((prev) => ({
      ...prev,
      lessons: [
        ...prev.lessons,
        {
          title: `Bài ${prev.lessons.length + 1}`,
          content: '',
          attachMode: 'youtube',
          youtubeUrl: '',
          fileName: '',
          filePreviewUrl: '',
          fileType: '',
          file: null,
          documentFileName: '',
          documentPreviewUrl: '',
          documentFileType: '',
          documentFile: null,
          codeLanguage: 'javascript',
          codeContent: '',
          documentContent: '',
        },
      ],
    }))

    window.setTimeout(() => {
      lessonEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }, 80)
  }

  function updateLesson(index, key, value) {
    setForm((prev) => {
      const nextLessons = [...prev.lessons]

      nextLessons[index] = {
        ...nextLessons[index],
        [key]: value,
      }

      return {
        ...prev,
        lessons: nextLessons,
      }
    })
  }

  function handleLessonFileChange(index, nameKey, previewKey, typeKey, event) {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    const fileKey = resolveFileStateKey(nameKey)

    setForm((prev) => {
      const nextLessons = [...prev.lessons]
      const currentLesson = nextLessons[index]

      revokeIfBlob(currentLesson[previewKey])

      nextLessons[index] = {
        ...currentLesson,
        [nameKey]: file.name,
        [previewKey]: previewUrl,
        [typeKey]: file.type || '',
        [fileKey]: file,
      }

      return {
        ...prev,
        lessons: nextLessons,
      }
    })

    event.target.value = ''
  }

  function removeLesson(index) {
    setForm((prev) => {
      if (prev.lessons.length <= 1) return prev

      const removedLesson = prev.lessons[index]
      revokeIfBlob(removedLesson.filePreviewUrl)
      revokeIfBlob(removedLesson.documentPreviewUrl)

      return {
        ...prev,
        lessons: prev.lessons.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (saving) return

    if (!currentUser?.uid) {
      alert('Bạn cần đăng nhập bằng tài khoản giáo viên để đăng bài E-learning.')
      return
    }

    if (!form.title.trim() || !form.topic.trim() || !form.description.trim()) {
      alert('Vui lòng nhập đầy đủ tên bài, chủ đề và mô tả bài học.')
      return
    }

    if (form.visibility === 'private' && !form.className) {
      alert('Vui lòng chọn lớp được phép xem bài học riêng tư.')
      return
    }

    try {
      setSaving(true)

      const thumbnailUpload = await uploadSelectedFile(
        form.thumbnailFile,
        `course-thumbnails/${currentUser.uid}`,
      )

      const mainFileUpload = await uploadSelectedFile(
        form.file,
        `course-files/${currentUser.uid}/main`,
      )

      const mainDocumentUpload = await uploadSelectedFile(
        form.documentFile,
        `course-files/${currentUser.uid}/documents`,
      )

      const lessons = await Promise.all(
        form.lessons.map(async (lesson, index) => {
          const lessonFileUpload = await uploadSelectedFile(
            lesson.file,
            `course-files/${currentUser.uid}/lessons/${index + 1}`,
          )

          const lessonDocumentUpload = await uploadSelectedFile(
            lesson.documentFile,
            `course-files/${currentUser.uid}/lesson-documents/${index + 1}`,
          )

          return {
            title: lesson.title || `Bài ${index + 1}`,
            content: lesson.content || '',
            attachMode: lesson.attachMode || 'youtube',
            youtubeUrl: lesson.youtubeUrl || '',
            fileName: lessonFileUpload.name || lesson.fileName || '',
            fileUrl: lessonFileUpload.url || '',
            fileType: lessonFileUpload.type || lesson.fileType || '',
            wordFileName: lessonFileUpload.name || lesson.fileName || '',
            wordFileUrl: lessonFileUpload.url || '',
            documentFileName: lessonDocumentUpload.name || lesson.documentFileName || '',
            documentFileUrl: lessonDocumentUpload.url || '',
            documentFileType: lessonDocumentUpload.type || lesson.documentFileType || '',
            codeLanguage: lesson.codeLanguage || 'javascript',
            codeContent: lesson.codeContent || '',
            documentContent: lesson.documentContent || '',
            richDocument: lesson.documentContent || '',
          }
        }),
      )

      const payload = {
        title: form.title.trim(),
        topic: form.topic.trim(),
        description: form.description.trim(),
        content: form.description.trim(),
        subject: fixedTeacherSubject,
        category: fixedTeacherSubject,
        teacherSubject: fixedTeacherSubject,
        teacherCode: String(form.teacherCode || '0000').replace(/\D/g, '').slice(0, 4).padEnd(4, '0'),
        courseCode: eLearningCodePreview,
        eLearningCode: eLearningCodePreview,
        visibility: form.visibility,
        className: form.visibility === 'private' ? form.className : '',
        classNames: form.visibility === 'private' && form.className ? [form.className] : [],
        openAt: form.openAt || '',
        openAtMs: getOpenAtMs(form.openAt),
        thumbnail: thumbnailUpload.url || '',
        thumbnailFileName: thumbnailUpload.name || form.thumbnailFileName || '',
        attachMode: form.attachMode,
        youtubeUrl: form.youtubeUrl || '',
        fileName: mainFileUpload.name || form.fileName || '',
        fileUrl: mainFileUpload.url || '',
        fileType: mainFileUpload.type || form.fileType || '',
        wordFileName: mainFileUpload.name || form.fileName || '',
        wordFileUrl: mainFileUpload.url || '',
        documentFileName: mainDocumentUpload.name || form.documentFileName || '',
        documentFileUrl: mainDocumentUpload.url || '',
        documentFileType: mainDocumentUpload.type || form.documentFileType || '',
        codeLanguage: form.codeLanguage || 'javascript',
        codeContent: form.codeContent || '',
        documentContent: form.documentContent || '',
        richDocument: form.documentContent || '',
        lessons,
        lessonCount: lessons.length,
        duration: form.youtubeUrl ? 'Đang cập nhật' : '---',
        teacherId: currentUser.uid,
        createdByUid: currentUser.uid,
        createdBy: currentUser.uid,
        teacherEmail: currentUser.email || teacherProfile?.email || '',
        teacherName,
        teacherDisplayName: teacherName,
        status: 'published',
        studentCount: 0,
        progress: 0,
        rating: 0,
        ratingTotal: 0,
        ratingCount: 0,
        views: 0,
      }

      const created = await apiRequest('/api/courses', {
        method: 'POST',
        body: payload,
      })

      const createdCourse = created?.course || created?.data || created

      setForm(initialForm)
      setActiveStep(1)
      onCreated?.(createdCourse)
      onClose()
    } catch (error) {
      console.error('Lỗi khi đăng bài E-learning:', error)
      alert('Không thể đăng bài E-learning. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={`fixed inset-0 z-[999] overflow-y-auto px-4 py-6 text-slate-950 backdrop-blur-md dark:text-white ${
        isDarkMode ? 'dark bg-slate-950/80' : 'bg-slate-200/70'
      }`}
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#050816] dark:shadow-sky-950/40"
      >
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/[0.03] lg:block">
          <div className="text-xs font-black uppercase tracking-[0.45em] text-sky-500 dark:text-sky-300">
            Tạo bài học
          </div>

          <h2 className="mt-4 text-3xl font-black text-slate-950 dark:text-white">
            Tạo E-learning
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">
            Mỗi bài học là một hành trình nhỏ, giúp học sinh tiếp cận kiến thức
            rõ ràng, chủ động và hứng thú hơn trong từng bước học tập.
          </p>

          <div className="mt-10 grid gap-3">
            <StepButton
              active={activeStep === 1}
              number="1"
              label="Thông tin"
              onClick={() => scrollToSection(1)}
            />

            <StepButton
              active={activeStep === 2}
              number="2"
              label="Phân quyền"
              onClick={() => scrollToSection(2)}
            />

            <StepButton
              active={activeStep === 3}
              number="3"
              label="Học liệu"
              onClick={() => scrollToSection(3)}
            />

            <StepButton
              active={activeStep === 4}
              number="4"
              label="Bài nhỏ"
              onClick={() => scrollToSection(4)}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-[#050816]/95">
            <div>
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                Thông tin E-learning
              </h2>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Bài học công khai không cần chọn lớp. Bài học riêng tư chỉ hiển
                thị cho lớp được giáo viên chọn.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              ×
            </button>
          </header>

          <div
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            className="custom-scrollbar flex-1 overflow-y-auto px-6 py-6"
          >
            <div className="grid gap-6">
              <div ref={sectionOneRef} className="scroll-mt-6">
                <FormSection
                  badge="01"
                  title="Thông tin chính"
                  subtitle="Nhập tên bài học, chủ đề, mô tả và mã nhận diện để học sinh dễ tìm kiếm."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      value={form.title}
                      onChange={(value) => updateForm('title', value)}
                      placeholder="Tên bài E-learning"
                    />

                    <TextInput
                      value={form.topic}
                      onChange={(value) => updateForm('topic', value)}
                      placeholder="Chủ đề bài học"
                    />

                    <div>
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-sky-500 dark:text-sky-300">
                        Chuyên môn giáo viên
                      </label>

                      <input
                        readOnly
                        value={fixedTeacherSubject}
                        className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 font-black text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
                      />
                    </div>

                    <TextInput
                      value={form.teacherCode}
                      onChange={updateTeacherCode}
                      placeholder="Mã giáo viên, ví dụ 0106"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 dark:border-sky-400/20 dark:bg-sky-400/10">
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
                      Mã E-learning
                    </div>

                    <div className="mt-2 font-black text-slate-950 dark:text-white">
                      {eLearningCodePreview}
                    </div>
                  </div>

                  <Textarea
                    value={form.description}
                    onChange={(value) => updateForm('description', value)}
                    placeholder="Mô tả ngắn về nội dung bài học"
                    rows={5}
                  />
                </FormSection>
              </div>

              <div ref={sectionTwoRef} className="scroll-mt-6">
                <FormSection
                  badge="02"
                  title="Phân quyền và thời gian mở"
                  subtitle="Công khai cho phép học sinh phù hợp xem bài. Riêng tư chỉ mở cho lớp được chỉ định."
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <CustomSelect
                      value={form.visibility}
                      onChange={updateVisibility}
                      options={[
                        { value: 'public', label: 'Công khai' },
                        { value: 'private', label: 'Riêng tư theo lớp' },
                      ]}
                    />

                    {form.visibility === 'private' ? (
                      <CustomSelect
                        value={form.className}
                        onChange={(value) => updateForm('className', value)}
                        options={[
                          {
                            value: '',
                            label: loadingClasses
                              ? 'Đang tải danh sách lớp...'
                              : teacherClasses.length
                                ? 'Chọn lớp được xem'
                                : 'Chưa có lớp trong Quản lý lớp học',
                          },
                          ...teacherClasses.map((classItem) => ({
                            value: classItem,
                            label: classItem,
                          })),
                        ]}
                      />
                    ) : (
                      <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 font-bold text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
                        Không giới hạn lớp
                      </div>
                    )}

                    <DateTimeInput
                      value={form.openAt}
                      onChange={(value) => updateForm('openAt', value)}
                    />
                  </div>

                  <ImagePicker
                    fileName={form.thumbnailFileName}
                    previewUrl={form.thumbnailPreview}
                    onChange={handleThumbnailChange}
                    onRemove={removeThumbnail}
                  />
                </FormSection>
              </div>

              <div ref={sectionThreeRef} className="scroll-mt-6">
                <FormSection
                  badge="03"
                  title="Học liệu chính"
                  subtitle="Chọn dạng học liệu chính cho bài E-learning: video, tệp, mã nguồn hoặc tài liệu."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <CustomSelect
                      value={form.attachMode}
                      onChange={(value) => updateForm('attachMode', value)}
                      options={[
                        { value: 'youtube', label: 'Video YouTube' },
                        { value: 'file', label: 'Tệp Word/PDF' },
                        { value: 'code', label: 'Mã nguồn' },
                        { value: 'document', label: 'Tài liệu' },
                      ]}
                    />

                    {form.attachMode === 'youtube' && (
                      <TextInput
                        value={form.youtubeUrl}
                        onChange={(value) => updateForm('youtubeUrl', value)}
                        placeholder="Link video YouTube"
                      />
                    )}

                    {form.attachMode === 'file' && (
                      <FilePicker
                        label="Thêm tệp Word/PDF"
                        fileName={form.fileName}
                        previewUrl={form.filePreviewUrl}
                        fileType={form.fileType}
                        accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) =>
                          handleMainFileChange(
                            'fileName',
                            'filePreviewUrl',
                            'fileType',
                            event,
                          )
                        }
                      />
                    )}

                    {form.attachMode === 'code' && (
                      <CustomSelect
                        value={form.codeLanguage}
                        onChange={(value) => updateForm('codeLanguage', value)}
                        options={[
                          { value: 'javascript', label: 'JavaScript' },
                          { value: 'cpp', label: 'C++' },
                        ]}
                      />
                    )}

                    {form.attachMode === 'document' && (
                      <FilePicker
                        label="Thêm tệp tài liệu"
                        fileName={form.documentFileName}
                        previewUrl={form.documentPreviewUrl}
                        fileType={form.documentFileType}
                        accept=".doc,.docx,.pdf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        onChange={(event) =>
                          handleMainFileChange(
                            'documentFileName',
                            'documentPreviewUrl',
                            'documentFileType',
                            event,
                          )
                        }
                      />
                    )}
                  </div>

                  {form.attachMode === 'youtube' && (
                    <YoutubePreview url={form.youtubeUrl} />
                  )}

                  {form.attachMode === 'code' && (
                    <Textarea
                      value={form.codeContent}
                      onChange={(value) => updateForm('codeContent', value)}
                      placeholder="Nhập mã nguồn minh họa cho bài học"
                      rows={10}
                      mono
                    />
                  )}

                  {form.attachMode === 'document' && (
                    <Textarea
                      value={form.documentContent}
                      onChange={(value) => updateForm('documentContent', value)}
                      placeholder="Nội dung tài liệu"
                      rows={8}
                    />
                  )}
                </FormSection>
              </div>

              <div ref={sectionFourRef} className="scroll-mt-6">
                <FormSection
                  badge="04"
                  title="Danh sách bài nhỏ"
                  subtitle="Chia bài E-learning thành nhiều phần để học sinh học theo từng bước."
                >
                  <div className="grid gap-4">
                    {form.lessons.map((lesson, index) => (
                      <div
                        key={index}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="font-black text-slate-950 dark:text-white">
                            Bài {index + 1}
                          </div>

                          {form.lessons.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLesson(index)}
                              className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-600 transition hover:bg-red-500 hover:text-white dark:text-red-200"
                            >
                              Xóa
                            </button>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <TextInput
                            value={lesson.title}
                            onChange={(value) =>
                              updateLesson(index, 'title', value)
                            }
                            placeholder="Tên bài nhỏ"
                          />

                          <CustomSelect
                            value={lesson.attachMode}
                            onChange={(value) =>
                              updateLesson(index, 'attachMode', value)
                            }
                            options={[
                              { value: 'youtube', label: 'Video YouTube' },
                              { value: 'file', label: 'Tệp Word/PDF' },
                              { value: 'code', label: 'Mã nguồn' },
                              { value: 'document', label: 'Tài liệu' },
                            ]}
                          />
                        </div>

                        <div className="mt-3">
                          <TextInput
                            value={lesson.content}
                            onChange={(value) =>
                              updateLesson(index, 'content', value)
                            }
                            placeholder="Mô tả ngắn"
                          />
                        </div>

                        {lesson.attachMode === 'youtube' && (
                          <div className="mt-3 grid gap-3">
                            <TextInput
                              value={lesson.youtubeUrl}
                              onChange={(value) =>
                                updateLesson(index, 'youtubeUrl', value)
                              }
                              placeholder="Link YouTube của bài nhỏ"
                            />

                            <YoutubePreview url={lesson.youtubeUrl} />
                          </div>
                        )}

                        {lesson.attachMode === 'file' && (
                          <div className="mt-3">
                            <FilePicker
                              label="Thêm tệp Word/PDF"
                              fileName={lesson.fileName}
                              previewUrl={lesson.filePreviewUrl}
                              fileType={lesson.fileType}
                              accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              onChange={(event) =>
                                handleLessonFileChange(
                                  index,
                                  'fileName',
                                  'filePreviewUrl',
                                  'fileType',
                                  event,
                                )
                              }
                            />
                          </div>
                        )}

                        {lesson.attachMode === 'code' && (
                          <div className="mt-3 grid gap-3">
                            <CustomSelect
                              value={lesson.codeLanguage}
                              onChange={(value) =>
                                updateLesson(index, 'codeLanguage', value)
                              }
                              options={[
                                { value: 'javascript', label: 'JavaScript' },
                                { value: 'cpp', label: 'C++' },
                              ]}
                            />

                            <Textarea
                              value={lesson.codeContent}
                              onChange={(value) =>
                                updateLesson(index, 'codeContent', value)
                              }
                              placeholder="Mã nguồn của bài nhỏ"
                              rows={8}
                              mono
                            />
                          </div>
                        )}

                        {lesson.attachMode === 'document' && (
                          <div className="mt-3 grid gap-3">
                            <FilePicker
                              label="Thêm tệp tài liệu"
                              fileName={lesson.documentFileName}
                              previewUrl={lesson.documentPreviewUrl}
                              fileType={lesson.documentFileType}
                              accept=".doc,.docx,.pdf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                              onChange={(event) =>
                                handleLessonFileChange(
                                  index,
                                  'documentFileName',
                                  'documentPreviewUrl',
                                  'documentFileType',
                                  event,
                                )
                              }
                            />

                            <Textarea
                              value={lesson.documentContent}
                              onChange={(value) =>
                                updateLesson(index, 'documentContent', value)
                              }
                              placeholder="Nội dung tài liệu của bài nhỏ"
                              rows={6}
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addLesson}
                      className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-dashed border-sky-400/60 bg-sky-400/10 px-5 py-5 text-sm font-black text-sky-600 transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-400/20 dark:text-sky-300"
                    >
                      <span>＋</span>
                      <span>Thêm bài nhỏ tiếp theo</span>
                    </button>

                    <div ref={lessonEndRef} />
                  </div>
                </FormSection>
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-[#050816]/95">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-sky-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {saving ? 'Đang đăng bài...' : 'Đăng bài E-learning'}
            </button>
          </footer>
        </div>
      </form>
    </div>
  )
}

function CustomSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const selectRef = useRef(null)

  const selectedOption =
    options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    function handleClickOutside(event) {
      if (!selectRef.current) return
      if (!selectRef.current.contains(event.target)) setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left font-black text-slate-900 outline-none transition hover:border-sky-300 focus:border-sky-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
      >
        <span className="line-clamp-1">{selectedOption?.label || 'Chọn'}</span>

        <span className={`ml-3 text-xs transition ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[1000] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-slate-950 dark:shadow-slate-950/60">
          {options.map((option) => {
            const active = option.value === value

            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`block w-full px-4 py-3 text-left text-sm font-bold transition ${
                  active
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DateTimeInput({ value, onChange }) {
  const [dateValue = '', timeValue = ''] = String(value || '').split('T')

  function updateDateInput(nextDate) {
    if (!nextDate) {
      onChange('')
      return
    }

    onChange(`${nextDate}T${timeValue || '07:00'}`)
  }

  function updateTimeInput(nextTime) {
    const nextDate = dateValue || getTodayValue()

    if (!nextTime) {
      onChange(`${nextDate}T07:00`)
      return
    }

    onChange(`${nextDate}T${nextTime}`)
  }

  return (
    <div className="rounded-2xl border border-sky-400 bg-white px-4 py-3 transition focus-within:ring-2 focus-within:ring-sky-300 dark:bg-slate-950">
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Thời gian mở
      </label>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={dateValue}
          onChange={(event) => updateDateInput(event.target.value)}
          className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/10 dark:text-white"
        />

        <input
          type="time"
          value={timeValue}
          onChange={(event) => updateTimeInput(event.target.value)}
          className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/10 dark:text-white"
        />
      </div>
    </div>
  )
}

function ImagePicker({ fileName, previewUrl, onChange, onRemove }) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-4 dark:border-sky-400/30 dark:bg-sky-400/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5">
          <span>🖼️</span>
          <span>Tải ảnh đại diện</span>

          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
          />
        </label>

        <div className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          {fileName || 'Chưa chọn ảnh'}
        </div>

        {previewUrl && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-500 hover:text-white dark:text-red-200"
          >
            Xóa ảnh
          </button>
        )}
      </div>

      {previewUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
          <img
            src={previewUrl}
            alt="Xem trước ảnh đại diện bài học"
            className="h-64 w-full object-cover"
          />
        </div>
      )}
    </div>
  )
}

function FilePicker({ label, fileName, previewUrl, fileType, accept, onChange }) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-4 dark:border-sky-400/30 dark:bg-sky-400/10">
      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5">
        <span>📎</span>
        <span>{label}</span>

        <input
          type="file"
          accept={accept}
          onChange={onChange}
          className="hidden"
        />
      </label>

      <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        {fileName || 'Chưa chọn tệp'}
      </div>

      <FilePreview
        fileName={fileName}
        previewUrl={previewUrl}
        fileType={fileType}
      />
    </div>
  )
}

function FilePreview({ fileName, previewUrl, fileType }) {
  if (!previewUrl || !fileName) return null

  const lowerName = fileName.toLowerCase()
  const isImage = fileType.startsWith('image/')
  const isPdf = fileType === 'application/pdf' || lowerName.endsWith('.pdf')
  const isText = fileType.startsWith('text/') || lowerName.endsWith('.txt')
  const isWord =
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx') ||
    fileType.includes('wordprocessingml') ||
    fileType === 'application/msword'

  if (isImage) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <img
          src={previewUrl}
          alt="Xem trước tệp hình ảnh"
          className="h-64 w-full object-cover"
        />
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:text-slate-200">
          Xem trước tệp PDF
        </div>

        <iframe
          title="Xem trước PDF"
          src={previewUrl}
          className="h-80 w-full bg-white"
        />
      </div>
    )
  }

  if (isText) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
        <div className="text-sm font-black text-slate-700 dark:text-slate-200">
          Tệp văn bản đã được chọn.
        </div>
      </div>
    )
  }

  if (isWord) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-2xl dark:bg-sky-400/10">
            📄
          </div>

          <div>
            <div className="font-black text-slate-900 dark:text-white">
              {fileName}
            </div>

            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Tệp Word đã được chọn. Trình duyệt không xem trước trực tiếp Word.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
      <div className="font-black text-slate-900 dark:text-white">
        {fileName}
      </div>

      <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Tệp đã được chọn.
      </div>
    </div>
  )
}

function YoutubePreview({ url }) {
  const videoId = getYoutubeVideoId(url)

  if (!url) return null

  if (!videoId) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
        Link YouTube chưa hợp lệ hoặc chưa đủ thông tin để xem trước.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:text-slate-200">
        Xem trước video
      </div>

      <div className="aspect-video w-full bg-slate-950">
        <iframe
          title="Xem trước video YouTube"
          src={`https://www.youtube.com/embed/${videoId}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  )
}

function StepButton({ active, number, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${
        active
          ? 'border-sky-300 bg-sky-400/10 text-slate-950 dark:text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
          active
            ? 'bg-sky-400 text-slate-950'
            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
        }`}
      >
        {number}
      </span>

      <span className="font-black">{label}</span>
    </button>
  )
}

function FormSection({ badge, title, subtitle, children }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-black text-white shadow-lg shadow-sky-500/20">
          {badge}
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">
            {title}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-4">{children}</div>
    </section>
  )
}

function TextInput({ value, onChange, placeholder, inputMode }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={fieldClass}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4, mono = false }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${fieldClass} resize-none ${
        mono ? 'font-mono text-sm leading-7' : ''
      }`}
    />
  )
}

const fieldClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:bg-slate-950'


function resolveFileStateKey(nameKey) {
  return String(nameKey || '').startsWith('document') ? 'documentFile' : 'file'
}

async function uploadSelectedFile(file, folder) {
  if (!file) {
    return { name: '', url: '', type: '', path: '' }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const uploaded = await apiRequest('/api/storage/e-learning/asset', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })

  const asset = uploaded?.asset || uploaded?.file || uploaded?.data || uploaded

  return {
    name: asset?.name || asset?.fileName || file.name || '',
    url: asset?.url || asset?.fileUrl || asset?.publicUrl || asset?.downloadUrl || '',
    type: asset?.type || asset?.contentType || file.type || '',
    path: asset?.path || asset?.key || asset?.objectKey || '',
  }
}

async function apiRequest(path, { method = 'GET', body, isFormData = false } = {}) {
  const token =
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') ||
    ''

  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body == null ? undefined : isFormData ? body : JSON.stringify(body),
  })

  let data = null
  try { data = await response.json() } catch { data = null }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `API request failed (${response.status})`)
  }

  return data
}

function getOpenAtMs(value) {
  if (!value) return 0

  const time = new Date(value).getTime()

  return Number.isFinite(time) ? time : 0
}

function getTodayValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function revokeIfBlob(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function getYoutubeVideoId(url) {
  const value = String(url || '').trim()

  if (!value) return ''

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1]
  }

  try {
    const urlObject = new URL(value)
    return urlObject.searchParams.get('v') || ''
  } catch {
    return ''
  }
}

function getTeacherSubject(teacherProfile) {
  return (
    teacherProfile?.subject ||
    teacherProfile?.teacherSubject ||
    teacherProfile?.mainSubject ||
    teacherProfile?.monHoc ||
    teacherProfile?.specialization ||
    teacherProfile?.chuyenMon ||
    'Chưa cập nhật chuyên môn'
  )
}

function getTeacherName(teacherProfile) {
  return (
    teacherProfile?.fullName ||
    teacherProfile?.name ||
    teacherProfile?.displayName ||
    teacherProfile?.teacherName ||
    teacherProfile?.email ||
    'Giáo viên'
  )
}

function getTeacherInitials(name) {
  const cleanName = String(name || 'GV')
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')

  if (!cleanName) return 'GV'

  const words = cleanName.split(/\s+/).filter(Boolean)

  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase()
  }

  return words
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function getSubjectCode(subject) {
  const map = {
    Toán: 'TO',
    'Vật lý': 'VL',
    'Hóa học': 'HH',
    'Sinh học': 'SH',
    'Tin học': 'TH',
    'Ngữ văn': 'NV',
    'Lịch sử': 'LS',
    'Địa lý': 'DL',
    'Tiếng Anh': 'TA',
    'Công nghệ': 'CN',
    'Quốc phòng - An ninh': 'QP',
    'Trải nghiệm hướng nghiệp': 'HN',
    'Giáo dục địa phương': 'DP',
    'Giáo dục thể chất': 'TD',
    'Giáo dục Kinh tế và Pháp luật': 'KT',
  }

  return map[subject] || 'MH'
}

export default ELearningCreateModal