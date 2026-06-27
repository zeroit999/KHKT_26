import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import { auth, db } from '../../components/firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import MaintenanceState from '../../components/ui/MaintenanceState.jsx';

function getSchoolYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getSemester(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 1 && month <= 5 ? 'II' : 'I';
}

const MAX_CLASS_IMAGE_SIZE = 900 * 1024;

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getInitial(name = '') {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] || name || '?').charAt(0).toUpperCase();
}

function getStudentDisplayName(student = {}) {
  return (
    student.name ||
    student.displayName ||
    student.email?.split('@')?.[0] ||
    'Chờ học sinh tham gia'
  );
}

function getTimeValue(value) {
  if (!value) return 0;
  return value?.toMillis?.() || value?.seconds || 0;
}

function sortStudentsByJoinTime(studentList = []) {
  return [...studentList].sort((a, b) => {
    const timeDiff = getTimeValue(a.createdAt) - getTimeValue(b.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return normalizeText(a.email).localeCompare(normalizeText(b.email));
  });
}

function getAutoStudentCode(index) {
  return `HS${String(index + 1).padStart(3, '0')}`;
}

function getStudentCode(student = {}, index = 0) {
  return student.studentCode || student.code || getAutoStudentCode(index);
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatScore(value) {
  const number = toNumber(value);
  return number === null ? '-' : number.toFixed(1);
}

function averageFromScores(scores = []) {
  const validScores = scores.map(toNumber).filter((score) => score !== null);
  if (!validScores.length) return null;
  return (
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length
  );
}

const emptyStudentRow = () => ({
  email: '',
});

function getTeacherSubject(userDetails = {}) {
  return (
    userDetails?.subject ||
    userDetails?.specializedSubject ||
    userDetails?.major ||
    userDetails?.teachingSubject ||
    userDetails?.department ||
    'Môn học'
  );
}

function getClassCover(index = 0) {
  const covers = [
    'linear-gradient(135deg, rgba(114,166,128,.75), rgba(255,255,255,.2)), url("https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(37,99,235,.35), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(245,158,11,.28), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(15,23,42,.35), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(234,179,8,.25), rgba(255,255,255,.12)), url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80")',
  ];

  return covers[index % covers.length];
}

function getClassCoverStyle(classItem, index = 0) {
  const cover =
    classItem?.coverPhotoUrl ||
    classItem?.coverUrl ||
    classItem?.coverPhoto ||
    '';
  if (!cover) return getClassCover(index);
  if (cover.includes('gradient(') || cover.trim().startsWith('url('))
    return cover;
  return `url("${cover}")`;
}

function TeacherClasses() {
  const { userDetails } = useAuth();
  const [activeTab, setActiveTab] = useState('students');
  const [queryText, setQueryText] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classView, setClassView] = useState('list');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [scoreTests, setScoreTests] = useState([]);
  const [scoreRows, setScoreRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [classForm, setClassForm] = useState({
    name: '',
    grade: '',
  });
  const [studentOpen, setStudentOpen] = useState(false);
  const [addingStudents, setAddingStudents] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentRows, setStudentRows] = useState([emptyStudentRow()]);
  const [studentEditOpen, setStudentEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [studentEditError, setStudentEditError] = useState('');
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [studentEditForm, setStudentEditForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [studentDeleteOpen, setStudentDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [studentDeleteError, setStudentDeleteError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteClassId, setDeleteClassId] = useState('');
  const [menuClassId, setMenuClassId] = useState('');
  const [deletingClass, setDeletingClass] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClassId, setSettingsClassId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    logoUrl: '',
    coverPhotoUrl: '',
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!menuClassId) return undefined;

    const closeMenuOnOutsideClick = (event) => {
      const isInsideMenu = event.target.closest?.(
        '.tile-menu, .tile-menu-popover'
      );
      if (!isInsideMenu) setMenuClassId('');
    };

    window.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () =>
      window.removeEventListener('mousedown', closeMenuOnOutsideClick);
  }, [menuClassId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) =>
      setCurrentUser(user || null)
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBrowserBackForward = (event) => {
      const historyState = event.state || {};

      if (historyState.classesPage === 'detail' && historyState.classId) {
        setSelectedClassId(historyState.classId);
        setClassView('detail');
        return;
      }

      setClassView('list');
    };

    window.history.replaceState(
      { ...(window.history.state || {}), classesPage: 'list' },
      ''
    );
    window.addEventListener('popstate', handleBrowserBackForward);

    return () =>
      window.removeEventListener('popstate', handleBrowserBackForward);
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setClasses([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    // Firestore gợi ý:
    // classes/{classId}: { name, grade, teacherId, schoolYear, status, studentCount, createdAt }
    // Nếu 1 giáo viên có nhiều lớp, query này trả về toàn bộ lớp của teacherId.
    // Không dùng orderBy('createdAt') ở đây để tránh lỗi cần composite index.
    // Lọc theo teacherId rồi sắp xếp ở client, vẫn realtime và hỗ trợ nhiều lớp.
    const classesQuery = query(
      collection(db, 'classes'),
      where('teacherId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      classesQuery,
      (snapshot) => {
        const nextClasses = snapshot.docs
          .map((classDoc) => ({
            id: classDoc.id,
            ...classDoc.data(),
          }))
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
            const bTime =
              b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
            return bTime - aTime;
          });

        setClasses(nextClasses);
        setSelectedClassId((currentId) => {
          if (nextClasses.some((item) => item.id === currentId))
            return currentId;
          return '';
        });
        setClassView((currentView) =>
          nextClasses.length ? currentView : 'list'
        );
        setLoading(false);
      },
      (error) => {
        console.error('Không thể tải danh sách lớp:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSubjects([]);
      setScoreTests([]);
      setScoreRows([]);
      return undefined;
    }

    // Firestore gợi ý:
    // classes/{classId}/students/{studentId}: { studentCode, email, name, status, createdAt }
    // Mã HS được giữ theo thứ tự tham gia trước/sau.
    const studentsQuery = collection(
      db,
      'classes',
      selectedClassId,
      'students'
    );

    const unsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      const nextStudents = sortStudentsByJoinTime(
        snapshot.docs.map((studentDoc) => ({
          id: studentDoc.id,
          ...studentDoc.data(),
        }))
      );
      setStudents(nextStudents);
    });

    return unsubscribe;
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) return undefined;

    // Firestore gợi ý:
    // classes/{classId}/subjects/{subjectId}: { name, order }
    const subjectsQuery = query(
      collection(db, 'classes', selectedClassId, 'subjects'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(subjectsQuery, (snapshot) => {
      const nextSubjects = snapshot.docs.map((subjectDoc) => ({
        id: subjectDoc.id,
        ...subjectDoc.data(),
      }));
      setSubjects(nextSubjects);
      setSelectedSubjectId((currentId) => {
        if (nextSubjects.some((item) => item.id === currentId))
          return currentId;
        return nextSubjects[0]?.id || '';
      });
    });

    return unsubscribe;
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) {
      setScoreTests([]);
      setScoreRows([]);
      return undefined;
    }

    // Firestore gợi ý:
    // classes/{classId}/subjects/{subjectId}/tests/{testId}: { name, code, order }
    const testsQuery = query(
      collection(
        db,
        'classes',
        selectedClassId,
        'subjects',
        selectedSubjectId,
        'tests'
      ),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(testsQuery, (snapshot) => {
      setScoreTests(
        snapshot.docs.map((testDoc) => ({ id: testDoc.id, ...testDoc.data() }))
      );
    });

    return unsubscribe;
  }, [selectedClassId, selectedSubjectId]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) {
      setScoreRows([]);
      return undefined;
    }

    // Firestore gợi ý:
    // classes/{classId}/subjects/{subjectId}/scores/{studentId}: {
    //   studentId, scores: { [testId]: number }, average?: number
    // }
    const scoresQuery = collection(
      db,
      'classes',
      selectedClassId,
      'subjects',
      selectedSubjectId,
      'scores'
    );

    const unsubscribe = onSnapshot(scoresQuery, (snapshot) => {
      setScoreRows(
        snapshot.docs.map((scoreDoc) => ({
          id: scoreDoc.id,
          ...scoreDoc.data(),
        }))
      );
    });

    return unsubscribe;
  }, [selectedClassId, selectedSubjectId]);

  const schoolYear = getSchoolYear(now);
  const semester = getSemester(now);
  const teacherSubject = getTeacherSubject(userDetails);

  const selectedClass = useMemo(
    () => classes.find((classItem) => classItem.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const classToDelete = useMemo(
    () =>
      classes.find((classItem) => classItem.id === deleteClassId) ||
      selectedClass ||
      null,
    [classes, deleteClassId, selectedClass]
  );

  const classToSettings = useMemo(
    () =>
      classes.find((classItem) => classItem.id === settingsClassId) ||
      selectedClass ||
      null,
    [classes, settingsClassId, selectedClass]
  );

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const filteredStudents = useMemo(() => {
    const keyword = normalizeText(queryText);
    const sortedStudents = sortStudentsByJoinTime(students);
    if (!keyword) return sortedStudents;

    return sortedStudents.filter((student, index) =>
      [
        getStudentCode(student, index),
        getStudentDisplayName(student),
        student.email,
        student.phone,
      ].some((value) => normalizeText(value).includes(keyword))
    );
  }, [queryText, students]);

  const rankedScoreRows = useMemo(() => {
    const keyword = normalizeText(queryText);
    const sortedStudents = sortStudentsByJoinTime(students);
    const studentsById = new Map(
      sortedStudents.map((student) => [student.id, student])
    );
    const scoresByStudentId = new Map(
      scoreRows.map((row) => [row.studentId || row.id, row])
    );

    return sortedStudents
      .map((student, studentIndex) => {
        const scoreRow = scoresByStudentId.get(student.id) || {};
        const scores = scoreTests.map(
          (test) => scoreRow.scores?.[test.id] ?? null
        );
        const average = toNumber(scoreRow.average) ?? averageFromScores(scores);

        return {
          id: student.id,
          student: studentsById.get(student.id),
          studentCode: getStudentCode(student, studentIndex),
          scores,
          average,
        };
      })
      .filter((row) => {
        if (!keyword) return true;
        return [
          row.studentCode,
          getStudentDisplayName(row.student),
          row.student?.email,
        ].some((value) => normalizeText(value).includes(keyword));
      })
      .sort((a, b) => {
        const scoreDiff = (b.average ?? -1) - (a.average ?? -1);
        if (scoreDiff !== 0) return scoreDiff;
        return (
          getTimeValue(a.student?.createdAt) -
          getTimeValue(b.student?.createdAt)
        );
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [queryText, scoreRows, scoreTests, students]);

  const stats = useMemo(() => {
    const averages = rankedScoreRows
      .map((row) => row.average)
      .filter((average) => average !== null);

    if (!averages.length) {
      return {
        max: '-',
        min: '-',
        classAverage: '-',
        excellent: 0,
        good: 0,
        total: rankedScoreRows.length,
      };
    }

    return {
      max: Math.max(...averages).toFixed(1),
      min: Math.min(...averages).toFixed(1),
      classAverage: (
        averages.reduce((sum, score) => sum + score, 0) / averages.length
      ).toFixed(1),
      excellent: averages.filter((score) => score >= 9).length,
      good: averages.filter((score) => score >= 8).length,
      total: rankedScoreRows.length,
    };
  }, [rankedScoreRows]);

  const openClassDetail = (classId) => {
    if (!classId) return;
    setSelectedClassId(classId);
    setClassView('detail');

    if (typeof window !== 'undefined') {
      const currentState = window.history.state || {};
      if (
        currentState.classesPage !== 'detail' ||
        currentState.classId !== classId
      ) {
        window.history.pushState({ classesPage: 'detail', classId }, '');
      }
    }
  };

  const goBackToClassList = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.state?.classesPage === 'detail'
    ) {
      window.history.back();
      return;
    }

    setClassView('list');
  };

  const resetClassForm = () => {
    setClassForm({
      name: '',
      grade: '',
    });
    setCreateError('');
  };

  const openCreateClass = () => {
    resetClassForm();
    setCreateOpen(true);
  };

  const closeCreateClass = () => {
    if (creating) return;
    setCreateOpen(false);
    resetClassForm();
  };

  const handleClassFormChange = (event) => {
    const { name, value } = event.target;
    setClassForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateClass = async (event) => {
    event.preventDefault();

    if (!currentUser?.uid) {
      setCreateError('Bạn cần đăng nhập để tạo lớp học.');
      return;
    }

    const className = classForm.name.trim();
    if (!className) {
      setCreateError('Vui lòng nhập tên lớp học.');
      return;
    }

    const grade = classForm.grade.trim();
    if (!grade) {
      setCreateError('Vui lòng nhập khối lớp để hệ thống sắp xếp sau này.');
      return;
    }

    try {
      setCreating(true);
      setCreateError('');

      const docRef = await addDoc(collection(db, 'classes'), {
        name: className,
        grade,
        gradeSort: Number(grade) || grade,
        subject: teacherSubject,
        teacherId: currentUser.uid,
        teacherEmail: currentUser.email || '',
        teacherName: currentUser.displayName || currentUser.email || '',
        schoolYear,
        status: 'active',
        studentCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'classes', docRef.id, 'subjects'), {
        name: teacherSubject,
        order: 1,
        isDefault: true,
        teacherId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSelectedClassId(docRef.id);
      setClassView('detail');
      setCreateOpen(false);
      resetClassForm();
    } catch (error) {
      console.error('Không thể tạo lớp học:', error);
      setCreateError(
        error?.message || 'Không thể tạo lớp học. Vui lòng thử lại.'
      );
    } finally {
      setCreating(false);
    }
  };

  const resetStudentForm = () => {
    setStudentRows([emptyStudentRow()]);
    setStudentError('');
  };

  const openAddStudents = () => {
    resetStudentForm();
    setStudentOpen(true);
  };

  const closeAddStudents = () => {
    if (addingStudents) return;
    setStudentOpen(false);
    resetStudentForm();
  };

  const handleStudentCellChange = (index, field, value) => {
    setStudentRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const addStudentRow = () => {
    setStudentRows((currentRows) => [...currentRows, emptyStudentRow()]);
  };

  const removeStudentRow = (index) => {
    setStudentRows((currentRows) =>
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const handleAddStudents = async (event) => {
    event.preventDefault();

    if (!selectedClassId) {
      setStudentError('Vui lòng chọn lớp trước khi thêm học sinh.');
      return;
    }

    const validRows = studentRows
      .map((row) => ({
        email: row.email.trim().toLowerCase(),
      }))
      .filter((row) => row.email);

    if (!validRows.length) {
      setStudentError('Vui lòng nhập ít nhất 1 email học sinh.');
      return;
    }

    const invalidEmail = validRows.some(
      (row) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
    );
    if (invalidEmail) {
      setStudentError('Email học sinh chưa đúng định dạng.');
      return;
    }

    const duplicatedEmail = validRows.some(
      (row, index) =>
        validRows.findIndex((item) => item.email === row.email) !== index
    );
    if (duplicatedEmail) {
      setStudentError('Có email bị trùng trong danh sách vừa nhập.');
      return;
    }

    const existingEmails = new Set(
      students.map((student) => normalizeText(student.email))
    );
    const alreadyInClass = validRows.find((row) =>
      existingEmails.has(row.email)
    );
    if (alreadyInClass) {
      setStudentError(`Email ${alreadyInClass.email} đã có trong lớp.`);
      return;
    }

    try {
      setAddingStudents(true);
      setStudentError('');

      const nextCodeStart = sortStudentsByJoinTime(students).length;

      await Promise.all(
        validRows.map((row, index) =>
          addDoc(collection(db, 'classes', selectedClassId, 'students'), {
            studentCode: getAutoStudentCode(nextCodeStart + index),
            email: row.email,
            name: '',
            status: 'Chờ tham gia',
            classId: selectedClassId,
            className: selectedClass?.name || '',
            teacherId: currentUser?.uid || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );

      await updateDoc(doc(db, 'classes', selectedClassId), {
        studentCount: increment(validRows.length),
        updatedAt: serverTimestamp(),
      });

      setStudentOpen(false);
      resetStudentForm();
    } catch (error) {
      console.error('Không thể thêm học sinh:', error);
      setStudentError(
        error?.message || 'Không thể thêm học sinh. Vui lòng thử lại.'
      );
    } finally {
      setAddingStudents(false);
    }
  };

  const openEditStudent = (student) => {
    setStudentToEdit(student);
    setStudentEditForm({
      name:
        getStudentDisplayName(student) === 'Chờ học sinh tham gia'
          ? ''
          : getStudentDisplayName(student),
      email: student.email || '',
      phone: student.phone || '',
    });
    setStudentEditError('');
    setStudentEditOpen(true);
  };

  const closeEditStudent = () => {
    if (editingStudent) return;
    setStudentEditOpen(false);
    setStudentToEdit(null);
    setStudentEditError('');
  };

  const handleStudentEditChange = (event) => {
    const { name, value } = event.target;
    setStudentEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();

    if (!selectedClassId || !studentToEdit?.id) {
      setStudentEditError('Không tìm thấy học sinh cần chỉnh sửa.');
      return;
    }

    const email = studentEditForm.email.trim().toLowerCase();
    if (!email) {
      setStudentEditError('Email học sinh không được để trống.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStudentEditError('Email học sinh chưa đúng định dạng.');
      return;
    }

    const duplicatedStudent = students.find(
      (student) =>
        student.id !== studentToEdit.id &&
        normalizeText(student.email) === email
    );
    if (duplicatedStudent) {
      setStudentEditError(`Email ${email} đã có trong lớp.`);
      return;
    }

    try {
      setEditingStudent(true);
      setStudentEditError('');

      await updateDoc(
        doc(db, 'classes', selectedClassId, 'students', studentToEdit.id),
        {
          name: studentEditForm.name.trim(),
          email,
          phone: studentEditForm.phone.trim(),
          updatedAt: serverTimestamp(),
        }
      );

      setStudentEditOpen(false);
      setStudentToEdit(null);
    } catch (error) {
      console.error('Không thể cập nhật học sinh:', error);
      setStudentEditError(
        error?.message || 'Không thể cập nhật học sinh. Vui lòng thử lại.'
      );
    } finally {
      setEditingStudent(false);
    }
  };

  const openDeleteStudent = (student) => {
    setStudentToDelete(student);
    setStudentDeleteError('');
    setStudentDeleteOpen(true);
  };

  const closeDeleteStudent = () => {
    if (deletingStudent) return;
    setStudentDeleteOpen(false);
    setStudentToDelete(null);
    setStudentDeleteError('');
  };

  const handleDeleteStudent = async () => {
    if (!selectedClassId || !studentToDelete?.id) {
      setStudentDeleteError('Không tìm thấy học sinh cần xóa.');
      return;
    }

    try {
      setDeletingStudent(true);
      setStudentDeleteError('');

      const batch = writeBatch(db);
      batch.delete(
        doc(db, 'classes', selectedClassId, 'students', studentToDelete.id)
      );
      subjects.forEach((subject) => {
        batch.delete(
          doc(
            db,
            'classes',
            selectedClassId,
            'subjects',
            subject.id,
            'scores',
            studentToDelete.id
          )
        );
      });
      await batch.commit();

      await updateDoc(doc(db, 'classes', selectedClassId), {
        studentCount: increment(-1),
        updatedAt: serverTimestamp(),
      });

      setStudentDeleteOpen(false);
      setStudentToDelete(null);
    } catch (error) {
      console.error('Không thể xóa học sinh:', error);
      setStudentDeleteError(
        error?.message || 'Không thể xóa học sinh. Vui lòng thử lại.'
      );
    } finally {
      setDeletingStudent(false);
    }
  };

  const openClassSettings = (classItem) => {
    const targetClass =
      typeof classItem === 'string'
        ? classes.find((item) => item.id === classItem)
        : classItem;

    if (!targetClass?.id) return;

    setSettingsClassId(targetClass.id);
    setSettingsForm({
      name: targetClass.name || '',
      logoUrl: targetClass.logoUrl || targetClass.logo || '',
      coverPhotoUrl:
        targetClass.coverPhotoUrl ||
        targetClass.coverUrl ||
        targetClass.coverPhoto ||
        '',
    });
    setSettingsError('');
    setMenuClassId('');
    setSettingsOpen(true);
  };

  const closeClassSettings = () => {
    if (savingSettings) return;
    setSettingsOpen(false);
    setSettingsClassId('');
    setSettingsError('');
  };

  const handleSettingsChange = (event) => {
    const { name, value } = event.target;
    setSettingsForm((current) => ({ ...current, [name]: value }));
  };

  const handleSettingsImageChange = (event, fieldName) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSettingsError('Vui lòng chọn đúng file ảnh.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_CLASS_IMAGE_SIZE) {
      setSettingsError(
        'Ảnh quá lớn. Vui lòng chọn ảnh dưới 900KB để lưu được lên Firebase.'
      );
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSettingsError('');
      setSettingsForm((current) => ({
        ...current,
        [fieldName]: String(reader.result || ''),
      }));
    };
    reader.onerror = () => {
      setSettingsError('Không thể đọc ảnh từ thiết bị. Vui lòng thử ảnh khác.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();

    if (!settingsClassId) {
      setSettingsError('Không tìm thấy lớp cần cập nhật.');
      return;
    }

    const nextName = settingsForm.name.trim();
    if (!nextName) {
      setSettingsError('Tên lớp không được để trống.');
      return;
    }

    try {
      setSavingSettings(true);
      setSettingsError('');

      await updateDoc(doc(db, 'classes', settingsClassId), {
        name: nextName,
        logoUrl: settingsForm.logoUrl,
        coverPhotoUrl: settingsForm.coverPhotoUrl,
        updatedAt: serverTimestamp(),
      });

      setSettingsOpen(false);
      setSettingsClassId('');
    } catch (error) {
      console.error('Không thể cập nhật lớp:', error);
      setSettingsError(
        error?.message || 'Không thể cập nhật lớp. Vui lòng thử lại.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const openDeleteClass = (classId = selectedClassId) => {
    setDeleteClassId(classId);
    setMenuClassId('');
    setSettingsOpen(false);
    setDeleteError('');
    setDeleteOpen(true);
  };

  const closeDeleteClass = () => {
    if (deletingClass) return;
    setDeleteOpen(false);
    setDeleteClassId('');
    setDeleteError('');
  };

  const deleteQuerySnapshot = async (snapshot) => {
    if (snapshot.empty) return;

    let batch = writeBatch(db);
    let operationCount = 0;

    for (const itemDoc of snapshot.docs) {
      batch.delete(itemDoc.ref);
      operationCount += 1;

      if (operationCount === 450) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  };

  const handleDeleteClass = async () => {
    const targetClassId = deleteClassId || selectedClassId;

    if (!targetClassId) {
      setDeleteError('Không tìm thấy lớp cần xóa.');
      return;
    }

    try {
      setDeletingClass(true);
      setDeleteError('');

      const classRef = doc(db, 'classes', targetClassId);
      const subjectsSnapshot = await getDocs(
        collection(db, 'classes', targetClassId, 'subjects')
      );

      await Promise.all(
        subjectsSnapshot.docs.map(async (subjectDoc) => {
          await deleteQuerySnapshot(
            await getDocs(
              collection(
                db,
                'classes',
                targetClassId,
                'subjects',
                subjectDoc.id,
                'tests'
              )
            )
          );
          await deleteQuerySnapshot(
            await getDocs(
              collection(
                db,
                'classes',
                targetClassId,
                'subjects',
                subjectDoc.id,
                'scores'
              )
            )
          );
        })
      );

      await deleteQuerySnapshot(
        await getDocs(collection(db, 'classes', targetClassId, 'students'))
      );
      await deleteQuerySnapshot(subjectsSnapshot);

      if (selectedClassId === targetClassId) {
        setSelectedClassId('');
      }

      const batch = writeBatch(db);
      batch.delete(classRef);
      await batch.commit();

      setDeleteOpen(false);
      setDeleteClassId('');
    } catch (error) {
      console.error('Không thể xóa lớp học:', error);
      setDeleteError(
        error?.message || 'Không thể xóa lớp học. Vui lòng thử lại.'
      );
    } finally {
      setDeletingClass(false);
    }
  };

  const createClassModal = createOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeCreateClass}
    >
      <form
        className="class-modal"
        onSubmit={handleCreateClass}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Tạo lớp mới</p>
            <h2>Thêm lớp học cho giáo viên</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeCreateClass}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <label>
          Tên lớp <span>*</span>
          <input
            name="name"
            value={classForm.name}
            onChange={handleClassFormChange}
            placeholder="Ví dụ: 10A1"
            autoFocus
          />
        </label>

        <label>
          Khối <span>*</span>
          <select
            name="grade"
            value={classForm.grade}
            onChange={handleClassFormChange}
          >
            <option value="">Chọn khối</option>
            <option value="10">Khối 10</option>
            <option value="11">Khối 11</option>
            <option value="12">Khối 12</option>
          </select>
        </label>

        <p className="modal-note">
          Môn học: <strong>{teacherSubject}</strong>. Năm học:{' '}
          <strong>{schoolYear}</strong>.
        </p>
        {createError ? <p className="form-error">{createError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeCreateClass}
            disabled={creating}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={creating}
          >
            {creating ? 'ĐANG TẠO...' : 'TẠO LỚP'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const addStudentModal = studentOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeAddStudents}
    >
      <form
        className="class-modal student-modal"
        onSubmit={handleAddStudents}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Thêm học sinh</p>
            <h2>{selectedClass?.name || 'Lớp học'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeAddStudents}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="student-add-table">
          <div className="student-add-head email-only-head">
            <span>Email học sinh *</span>
            <span />
          </div>

          {studentRows.map((row, index) => (
            <div className="student-add-row email-only-row" key={index}>
              <input
                type="email"
                value={row.email}
                onChange={(event) =>
                  handleStudentCellChange(index, 'email', event.target.value)
                }
                placeholder="hoc sinh@email.com"
                autoFocus={index === 0}
              />
              <button
                type="button"
                className="row-remove-btn"
                onClick={() => removeStudentRow(index)}
                disabled={studentRows.length === 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <p className="modal-note">
          Mã HS sẽ tự tạo dạng <strong>HS001, HS002...</strong> theo thứ tự học
          sinh tham gia trước/sau.
        </p>
        <button
          type="button"
          className="ghost-btn add-row-btn"
          onClick={addStudentRow}
        >
          ＋ Thêm email
        </button>
        {studentError ? <p className="form-error">{studentError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeAddStudents}
            disabled={addingStudents}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={addingStudents}
          >
            {addingStudents ? 'ĐANG LƯU...' : 'LƯU HỌC SINH'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const editStudentModal = studentEditOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeEditStudent}
    >
      <form
        className="class-modal"
        onSubmit={handleUpdateStudent}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Chỉnh sửa học sinh</p>
            <h2>
              {getStudentCode(
                studentToEdit,
                sortStudentsByJoinTime(students).findIndex(
                  (student) => student.id === studentToEdit?.id
                )
              )}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeEditStudent}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <label>
          Họ và tên
          <input
            name="name"
            value={studentEditForm.name}
            onChange={handleStudentEditChange}
            placeholder="Nguyễn Văn A"
            autoFocus
          />
        </label>

        <label>
          Email <span>*</span>
          <input
            type="email"
            name="email"
            value={studentEditForm.email}
            onChange={handleStudentEditChange}
            placeholder="hocsinh@email.com"
          />
        </label>

        <label>
          Số điện thoại
          <input
            name="phone"
            value={studentEditForm.phone}
            onChange={handleStudentEditChange}
            placeholder="09..."
          />
        </label>

        <p className="modal-note">
          Mã HS giữ nguyên theo thứ tự tham gia. Trạng thái được đồng bộ từ
          Firebase và tự đổi khi học sinh hoàn tất dữ liệu.
        </p>
        {studentEditError ? (
          <p className="form-error">{studentEditError}</p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeEditStudent}
            disabled={editingStudent}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={editingStudent}
          >
            {editingStudent ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const deleteStudentModal = studentDeleteOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeDeleteStudent}
    >
      <div
        className="class-modal delete-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Xóa học sinh</p>
            <h2>{getStudentDisplayName(studentToDelete || {})}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeDeleteStudent}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <p className="delete-warning">
          Thao tác này sẽ xóa học sinh khỏi lớp và xóa điểm số liên quan của học
          sinh này.
        </p>
        <p className="modal-note">
          Mã HS của các học sinh khác sẽ không tự đổi sau khi xóa.
        </p>
        {studentDeleteError ? (
          <p className="form-error">{studentDeleteError}</p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeDeleteStudent}
            disabled={deletingStudent}
          >
            Hủy
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={handleDeleteStudent}
            disabled={deletingStudent}
          >
            {deletingStudent ? 'ĐANG XÓA...' : 'XÓA HỌC SINH'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const deleteClassModal = deleteOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeDeleteClass}
    >
      <div
        className="class-modal delete-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Xóa lớp học</p>
            <h2>{classToDelete?.name || 'Lớp học'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeDeleteClass}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <p className="delete-warning">
          Thao tác này sẽ xóa lớp đang chọn cùng danh sách học sinh, môn học,
          bài kiểm tra và điểm số liên quan trên Firebase.
        </p>
        <p className="modal-note">Hành động này không thể hoàn tác.</p>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeDeleteClass}
            disabled={deletingClass}
          >
            Hủy
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={handleDeleteClass}
            disabled={deletingClass}
          >
            {deletingClass ? 'ĐANG XÓA...' : 'XÓA LỚP'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const classSettingsModal = settingsOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeClassSettings}
    >
      <form
        className="class-modal settings-modal"
        onSubmit={handleSaveSettings}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Chỉnh sửa lớp</p>
            <h2>{classToSettings?.name || 'Lớp học'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeClassSettings}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <section className="settings-section">
          <div className="settings-index">1</div>
          <label>
            Tên lớp
            <input
              name="name"
              value={settingsForm.name}
              onChange={handleSettingsChange}
              placeholder="Nhập tên lớp mới"
              autoFocus
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-index">2</div>
          <div className="settings-fields">
            <label>
              Ảnh đại diện lớp
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleSettingsImageChange(event, 'logoUrl')
                }
              />
            </label>
            <label>
              Ảnh bìa lớp
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleSettingsImageChange(event, 'coverPhotoUrl')
                }
              />
            </label>
            <div className="settings-preview">
              <div
                className="preview-cover"
                style={{
                  backgroundImage: settingsForm.coverPhotoUrl
                    ? `url(${settingsForm.coverPhotoUrl})`
                    : 'linear-gradient(135deg,#dbeafe,#f8fafc)',
                }}
              >
                <div className="preview-logo">
                  {settingsForm.logoUrl ? (
                    <img src={settingsForm.logoUrl} alt="Ảnh đại diện lớp" />
                  ) : (
                    getInitial(settingsForm.name)
                  )}
                </div>
              </div>
              <p>
                Chọn ảnh trực tiếp từ thiết bị. Ảnh sẽ được xem trước trước khi
                lưu.
              </p>
            </div>
          </div>
        </section>

        {settingsError ? <p className="form-error">{settingsError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeClassSettings}
            disabled={savingSettings}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={savingSettings}
          >
            {savingSettings ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  if (loading) {
    return (
      <main className="classes-page class-hub-page">
        <section className="hub-top">
          <div className="hub-action-card new-class-card">
            <div className="hub-plus">＋</div>
            <div>
              <h2>Lớp mới</h2>
              <p>Nhiều chế độ học linh hoạt</p>
            </div>
          </div>
        </section>
        <section className="class-hub">
          <div className="class-card-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="class-tile skeleton-tile">
                <div className="skeleton-cover" />
                <div className="class-tile-body">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-sub" />
                </div>
              </div>
            ))}
          </div>
        </section>
        {createClassModal}
        <style>{styles}</style>
      </main>
    );
  }

  if (!classes.length) {
    return (
      <main className="classes-page class-hub-page">
        <section className="hub-top">
          <div
            className="hub-action-card new-class-card"
            role="button"
            tabIndex={0}
            onClick={openCreateClass}
            onKeyDown={(event) => event.key === 'Enter' && openCreateClass()}
          >
            <div className="hub-plus">＋</div>
            <div>
              <h2>Lớp mới</h2>
              <p>Nhiều chế độ học linh hoạt</p>
            </div>
          </div>
        </section>

        <section className="class-hub">
          <section className="hub-empty-state compact-empty-state">
            <div className="empty-icon">🎓</div>
            <h1>Bạn chưa có lớp</h1>
            <p>
              Bấm <strong>Lớp mới</strong> phía trên để tạo lớp đầu tiên.
            </p>
          </section>
        </section>

        {createClassModal}
        {addStudentModal}
        {deleteClassModal}
        {editStudentModal}
        {deleteStudentModal}
        {classSettingsModal}
        <style>{styles}</style>
      </main>
    );
  }

  if (classView === 'list' || !selectedClassId) {
    return (
      <main className="classes-page class-hub-page">
        <section className="hub-top">
          <div
            className="hub-action-card new-class-card"
            role="button"
            tabIndex={0}
            onClick={openCreateClass}
            onKeyDown={(event) => event.key === 'Enter' && openCreateClass()}
          >
            <div className="hub-plus">＋</div>
            <div>
              <h2>Lớp mới</h2>
              <p>Nhiều chế độ học linh hoạt</p>
            </div>
          </div>
        </section>

        <section className="class-hub">
          <div className="class-card-grid">
            {classes.map((classItem, index) => (
              <article
                className="class-tile"
                key={classItem.id}
                role="button"
                tabIndex={0}
                onClick={() => openClassDetail(classItem.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') openClassDetail(classItem.id);
                }}
              >
                <div
                  className="class-cover"
                  style={{
                    backgroundImage: getClassCoverStyle(classItem, index),
                  }}
                >
                  <button
                    className="tile-edit-btn"
                    type="button"
                    aria-label="Chỉnh sửa lớp"
                    title="Chỉnh sửa lớp"
                    onClick={(event) => {
                      event.stopPropagation();
                      openClassSettings(classItem);
                    }}
                  >
                    ✎
                  </button>
                  <div className="class-icon">
                    {classItem.logoUrl || classItem.logo ? (
                      <img
                        src={classItem.logoUrl || classItem.logo}
                        alt="Ảnh đại diện lớp"
                      />
                    ) : (
                      getInitial(classItem.name)
                    )}
                  </div>
                </div>
                <div className="class-tile-body">
                  <h3>{classItem.name}</h3>
                  <p className="class-tile-meta">
                    <span>{classItem.teacherName || classItem.subject || 'Megaedu'}</span>
                    {classItem.grade ? (
                      <span className="class-tile-grade">Khối {classItem.grade}</span>
                    ) : null}
                  </p>
                </div>
                <button
                  className="tile-menu"
                  type="button"
                  aria-label="Tùy chọn"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuClassId((currentId) =>
                      currentId === classItem.id ? '' : classItem.id
                    );
                  }}
                >
                  ...
                </button>
                {menuClassId === classItem.id ? (
                  <div
                    className="tile-menu-popover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="delete-menu-item"
                      onClick={() => openDeleteClass(classItem.id)}
                    >
                      🗑 Xóa lớp
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {createClassModal}
        {addStudentModal}
        {deleteClassModal}
        {editStudentModal}
        {deleteStudentModal}
        {classSettingsModal}
        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="classes-page">
      <header className="hero">
        <div>
          <h1>
            <span>▰</span> {selectedClass?.name || 'Lớp học'}
          </h1>
          <p>Năm học {selectedClass?.schoolYear || schoolYear}</p>
        </div>

        <div className="hero-actions">
          {classes.length > 1 && (
            <label className="class-select">
              Lớp học
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
              >
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            className="back-class-btn"
            type="button"
            onClick={goBackToClassList}
          >
            ← DANH SÁCH
          </button>

          <div className="hero-stats">
            <div>
              <span>👥 Sĩ số</span>
              <strong>{selectedClass?.studentCount || students.length}</strong>
            </div>
            <div>
              <span>▣ Học kỳ</span>
              <strong>{semester}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="content">
        <div className="tabs">
          <button
            className={activeTab === 'students' ? 'active' : ''}
            onClick={() => setActiveTab('students')}
          >
            HỌC SINH
          </button>
          <button
            className={activeTab === 'scores' ? 'active' : ''}
            onClick={() => setActiveTab('scores')}
          >
            ĐIỂM SỐ
          </button>
        </div>

        {activeTab === 'students' ? (
          <>
            <div className="toolbar">
              <label className="search">
                ⌕
                <input
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder="Tìm kiếm học sinh..."
                />
              </label>
              <button
                className="primary-btn"
                type="button"
                onClick={openAddStudents}
              >
                ♣ THÊM HỌC SINH
              </button>
            </div>

            {filteredStudents.length ? (
              <div className="student-grid">
                {filteredStudents.map((student, index) => (
                  <article className="student-card" key={student.id}>
                    <div className="avatar">
                      {getInitial(getStudentDisplayName(student))}
                    </div>
                    <div className="student-info">
                      <div className="card-head">
                        <h3>{getStudentDisplayName(student)}</h3>
                        <span>{student.status || 'Chờ cập nhật'}</span>
                      </div>
                      <p>{getStudentCode(student, index)}</p>
                      <p>✉ {student.email || 'Chưa có email'}</p>
                      <p>☎ {student.phone || 'Chưa có SĐT'}</p>
                      <div className="actions">
                        <button
                          type="button"
                          onClick={() => openEditStudent(student)}
                          title="Chỉnh sửa học sinh"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => openDeleteStudent(student)}
                          title="Xóa học sinh"
                        >
                          ■
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-line">Chưa có học sinh phù hợp.</p>
            )}
          </>
        ) : (
          <>
            <div className="toolbar score-toolbar">
              <div className="subject-display">
                <span>Môn học</span>
                <strong>
                  {selectedSubject?.name ||
                    selectedClass?.subject ||
                    teacherSubject}
                </strong>
              </div>
              <label className="search">
                ⌕
                <input
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder="Tìm kiếm học sinh..."
                />
              </label>
            </div>

            {!students.length ? (
              <p className="empty-line">Chưa có dữ liệu</p>
            ) : !selectedSubject ? (
              <p className="empty-line">Lớp này chưa có môn học.</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Xếp hạng</th>
                        <th>Mã HS</th>
                        <th>Họ và tên</th>
                        {scoreTests.map((test, index) => (
                          <th key={test.id}>
                            {test.name || `Bài ${index + 1}`}
                            <br />
                            <small>({test.code || test.id})</small>
                          </th>
                        ))}
                        <th className="avg-head">TB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!rankedScoreRows.length ? (
                        <tr>
                          <td
                            className="table-empty"
                            colSpan={4 + scoreTests.length}
                          >
                            Chưa có dữ liệu
                          </td>
                        </tr>
                      ) : null}
                      {rankedScoreRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className={`rank rank-${row.rank}`}>
                              {row.rank}
                            </span>
                          </td>
                          <td>{row.studentCode}</td>
                          <td>{getStudentDisplayName(row.student)}</td>
                          {row.scores.map((score, index) => (
                            <td key={scoreTests[index]?.id || index}>
                              {formatScore(score)}
                            </td>
                          ))}
                          <td
                            className={
                              row.average >= 8
                                ? 'avg good'
                                : row.average !== null && row.average < 6
                                  ? 'avg weak'
                                  : 'avg'
                            }
                          >
                            {formatScore(row.average)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="summary-grid">
                  <StatCard
                    label="Điểm TB cao nhất"
                    value={stats.max}
                    tone="green"
                  />
                  <StatCard
                    label="Điểm TB thấp nhất"
                    value={stats.min}
                    tone="red"
                  />
                  <StatCard
                    label="Điểm TB lớp"
                    value={stats.classAverage}
                    tone="blue"
                  />
                  <StatCard
                    label="HS Xuất sắc (≥9.0)"
                    value={`${stats.excellent}/${stats.total}`}
                    tone="purple"
                  />
                  <StatCard
                    label="HS Giỏi (≥8.0)"
                    value={`${stats.good}/${stats.total}`}
                    tone="green"
                  />
                </div>
              </>
            )}
          </>
        )}
      </section>
      {createClassModal}
      {addStudentModal}
      {deleteClassModal}
      {editStudentModal}
      {deleteStudentModal}
      {classSettingsModal}
      <style>{styles}</style>
    </main>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong className={tone}>{value}</strong>
    </article>
  );
}

const styles = `
.classes-page{min-height:100vh;background:#fff;color:#050816;font-family:Inter,Roboto,Arial,sans-serif;transition:background .2s,color .2s}.class-hub-page{background:#fff}.hub-top{max-width:1420px;margin:0 auto;padding:26px 24px 12px;display:grid;grid-template-columns:1fr;gap:24px}.hub-action-card{min-height:96px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;gap:16px;padding:0 30px;overflow:hidden;position:relative;box-shadow:0 1px 8px rgba(15,23,42,.08);cursor:pointer}.hub-action-card h2{margin:0 0 6px;font-size:22px;font-weight:900}.hub-action-card p{margin:0;font-size:15px}.new-class-card{background:linear-gradient(100deg,#438df2,#4a95fb);color:#fff}.hub-plus{font-size:34px;font-weight:300;line-height:1}.hub-plus.muted{color:#6b7280}.play-preview{margin-left:auto;width:104px;height:70px;border:4px solid #c8d4f5;border-radius:12px;display:grid;place-items:center;color:#9eb7ff;font-size:28px;background:rgba(255,255,255,.55)}.class-hub{max-width:1420px;margin:0 auto;padding:12px 24px 70px}.class-tabs{display:flex;gap:44px;align-items:center;margin-bottom:24px}.class-tabs button{border:0;background:transparent;color:#777;font-size:20px;cursor:pointer;padding:0}.class-tabs button.active{color:#111827;font-weight:900}.class-card-grid{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:22px}.hub-empty-state{max-width:520px;margin:74px auto 0;padding:44px 30px;text-align:center;border:1px solid #eef0f4;border-radius:18px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.08)}.hub-empty-state h1{margin:16px 0 8px;font-size:20px;font-weight:800;color:#111827}.hub-empty-state p{margin:0 auto;color:#667085;font-size:16px;line-height:1.55;max-width:360px}.hub-empty-state p strong{color:#2563eb}.compact-empty-state{padding:38px 30px}.class-tile{min-height:300px;border:1px solid #eef0f4;border-radius:20px;background:#fff;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,.04);position:relative;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}.class-tile:hover{transform:translateY(-4px);box-shadow:0 12px 26px rgba(15,23,42,.12)}.class-cover{height:142px;background-size:cover;background-position:center;position:relative}.class-icon{position:absolute;left:18px;bottom:-20px;width:48px;height:48px;border-radius:12px;background:#eef2ff;color:#2563eb;display:grid;place-items:center;font-weight:900;box-shadow:0 8px 18px rgba(15,23,42,.2);overflow:hidden}.class-icon img{width:100%;height:100%;object-fit:cover}.class-tile-body{padding:34px 18px 46px}.class-tile-grade{display:inline-block;margin:0 0 6px;background:#1976d2;color:#fff;font-size:12px;font-weight:800;border-radius:6px;padding:2px 9px;letter-spacing:.04em}.dark .class-tile-grade{background:#2563eb}.class-tile-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0}.class-tile-meta>span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.class-tile-grade{background:transparent;color:#9ca3af;font-size:13px;font-weight:500;border-radius:0;padding:0;letter-spacing:0;white-space:nowrap}.dark .class-tile-grade{background:transparent;color:#6b7280}.class-tile-body p{margin:0;color:#9ca3af;font-size:16px}.tile-menu{position:absolute;right:17px;bottom:18px;border:0;background:transparent;color:#9ca3af;font-size:21px;cursor:pointer;z-index:3}.tile-edit-btn{position:absolute;top:12px;right:12px;width:34px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.92);color:#1f2937;font-size:16px;font-weight:900;box-shadow:0 8px 18px rgba(15,23,42,.18);cursor:pointer;z-index:4;display:grid;place-items:center}.tile-edit-btn:hover{background:#fff;color:#1976d2;transform:translateY(-1px)}.tile-menu-popover{position:absolute;right:14px;bottom:48px;z-index:5;width:190px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.16);padding:6px}.tile-menu-popover button{width:100%;border:0;border-radius:9px;background:transparent;color:#334155;font-size:14px;font-weight:800;text-align:left;padding:10px 11px;cursor:pointer}.tile-menu-popover button:hover{background:#eff6ff}.tile-menu-popover .delete-menu-item{color:#dc2626}.tile-menu-popover .delete-menu-item:hover{background:#fee2e2}.settings-section{display:grid;grid-template-columns:34px 1fr;gap:14px;margin-top:16px;border:1px solid #e5e7eb;border-radius:14px;padding:14px}.settings-index{width:28px;height:28px;border-radius:999px;background:#1976d2;color:#fff;display:grid;place-items:center;font-weight:900}.settings-fields{display:grid;gap:12px}.settings-danger-row{display:flex;justify-content:space-between;align-items:center;gap:14px}.settings-danger-row strong{display:block;margin-bottom:5px;color:#0f172a}.settings-danger-row p{margin:0;color:#64748b;font-size:13px;line-height:1.45}.settings-preview{border:1px dashed #cbd5e1;border-radius:14px;padding:12px;background:#f8fafc}.preview-cover{height:150px;border-radius:12px;background-size:cover;background-position:center;position:relative}.preview-logo{position:absolute;left:18px;bottom:-24px;width:56px;height:56px;border-radius:50%;background:#1976d2;color:#fff;border:4px solid #fff;display:grid;place-items:center;font-weight:900;font-size:20px;overflow:hidden;box-shadow:0 8px 18px rgba(15,23,42,.2)}.preview-logo img{width:100%;height:100%;object-fit:cover}.settings-preview p{margin:34px 0 0;color:#64748b;font-size:13px}.settings-modal{width:min(680px,100%)}.back-class-btn{border:1px solid rgba(255,255,255,.25);border-radius:6px;background:#111827;color:#fff;font-weight:800;letter-spacing:.3px;padding:11px 16px;box-shadow:0 2px 5px rgba(0,0,0,.28);cursor:pointer;white-space:nowrap}.delete-class-btn{border:1px solid rgba(255,255,255,.25);border-radius:6px;background:#dc2626;color:#fff;font-weight:800;letter-spacing:.3px;padding:11px 16px;box-shadow:0 2px 5px rgba(0,0,0,.28);cursor:pointer;white-space:nowrap}.danger-btn{border:0;border-radius:10px;background:#dc2626;color:#fff;font-weight:900;letter-spacing:.4px;padding:11px 18px;box-shadow:0 2px 5px rgba(0,0,0,.24);cursor:pointer}.danger-btn:disabled{cursor:not-allowed;opacity:.65}.delete-warning{margin:0;border-radius:12px;background:#fee2e2;color:#991b1b;padding:14px 16px;font-size:14px;font-weight:800;line-height:1.55}.create-class-btn{border:1px solid rgba(255,255,255,.25);border-radius:6px;background:#1976d2;color:#fff;font-weight:800;letter-spacing:.3px;padding:11px 16px;box-shadow:0 2px 5px rgba(0,0,0,.28);cursor:pointer;white-space:nowrap}.empty-create-btn{min-height:46px;margin-top:18px}.hero{min-height:120px;background:#050517;color:white;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px max(24px,calc((100vw - 1216px)/2));box-shadow:0 8px 24px rgba(0,0,0,.18)}.hero h1{font-size:24px;margin:0 0 18px;font-weight:800}.hero h1 span{font-size:19px}.hero p{margin:0;font-size:16px}.hero-actions{display:flex;align-items:center;gap:30px}.class-select{display:grid;gap:6px;color:#dfe6ff;font-size:13px}.class-select select{min-width:190px;border:1px solid rgba(255,255,255,.25);border-radius:6px;background:#121229;color:#fff;padding:9px 12px;font-size:14px}.hero-stats{display:flex;gap:54px}.hero-stats div{display:grid;gap:6px;text-align:center}.hero-stats span{font-size:15px}.hero-stats strong{font-size:30px;line-height:1}.content{max-width:1216px;margin:44px auto;padding:0 16px}.tabs{display:flex;border-bottom:1px solid #ddd;margin-bottom:24px}.tabs button{background:transparent;border:0;padding:0 16px 16px;font-size:14px;color:#555;letter-spacing:.4px;cursor:pointer}.tabs button.active{color:#1976d2;border-bottom:2px solid #1976d2}.toolbar{display:flex;gap:16px;align-items:stretch;margin-bottom:24px}.search{flex:1;border:1px solid #222;border-radius:3px;display:flex;align-items:center;gap:10px;padding:0 14px;color:#777;min-height:54px}.search input{border:0;outline:0;width:100%;font-size:16px;background:transparent;color:inherit}.primary-btn{border:0;border-radius:3px;background:#1976d2;color:#fff;font-weight:700;letter-spacing:.4px;padding:0 28px;box-shadow:0 2px 5px rgba(0,0,0,.28);cursor:pointer}.student-grid{display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));gap:16px}.student-card{min-height:144px;border:1px solid #eee;border-radius:5px;box-shadow:0 2px 3px rgba(0,0,0,.26);display:flex;gap:16px;padding:16px}.avatar{width:56px;height:56px;border-radius:50%;background:#1976d2;color:#fff;display:grid;place-items:center;font-size:22px;flex:0 0 56px}.student-info{flex:1}.card-head{display:flex;justify-content:space-between;gap:12px}.card-head h3{margin:3px 0 4px;font-size:18px}.card-head span{background:#258034;color:#fff;border-radius:12px;padding:4px 8px;font-size:12px;font-weight:700;height:max-content}.student-info p{margin:7px 0;color:#667;font-size:13px}.actions{display:flex;gap:20px;margin-top:18px}.actions button{border:0;background:transparent;color:#1976d2;font-size:18px;cursor:pointer}.actions .danger{color:#d32f2f}.score-toolbar{align-items:center}.select-label{width:180px;border:1px solid #ccc;border-radius:3px;padding:8px 14px 4px;color:#555;font-size:12px}.select-label select{display:block;border:0;outline:0;width:100%;font-size:16px;background:transparent;color:inherit;margin-top:6px}.subject-display{width:180px;border:1px solid #ccc;border-radius:3px;padding:8px 14px 7px;color:#555;font-size:12px;background:#fff}.subject-display span{display:block}.subject-display strong{display:block;margin-top:6px;color:#050816;font-size:16px}.table-empty{text-align:center!important;color:#667;font-weight:800;padding:28px!important}.table-wrap{border-radius:4px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,.24);border:1px solid #eee}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:16px;text-align:left;border-bottom:1px solid #e0e0e0;font-size:14px}th{font-weight:700}th:not(:nth-child(-n+3)),td:not(:nth-child(-n+3)){text-align:center}.avg-head{background:#1976d2;color:white}.avg{font-weight:800;color:#0a55ff;background:#fafafa}.avg.good{color:#00a83b}.avg.weak{color:#d58200}.rank{display:inline-flex;align-items:center;border-radius:14px;padding:5px 9px;background:#1976d2;color:#fff;font-weight:800;font-size:12px}.rank-1,.rank-2,.rank-3{background:#258034}.rank-1{background:#ef6c00}.summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-top:24px}.stat-card{border:1px solid #ddd;border-radius:8px;padding:18px 16px}.stat-card p{margin:0 0 10px;color:#667;font-size:14px}.stat-card strong{font-size:24px}.green{color:#00a83b}.red{color:red}.blue{color:#0a55ff}.purple{color:#8a22ff}.empty-card{max-width:520px;margin:80px auto;padding:42px 30px;text-align:center;border:1px solid #e4e4e4;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.08)}.empty-icon{font-size:46px}.empty-card h1{margin:16px 0 8px}.empty-card p,.empty-line{color:#666}.empty-line{padding:24px;border:1px dashed #ddd;border-radius:8px}.student-modal{width:min(980px,100%)}.student-add-table{display:grid;gap:8px;margin-top:12px;overflow-x:auto}.student-add-head,.student-add-row{display:grid;grid-template-columns:130px 1.3fr 1fr 130px 42px;gap:8px;align-items:center;min-width:780px}.student-add-head.email-only-head,.student-add-row.email-only-row{grid-template-columns:minmax(260px,1fr) 42px;min-width:0}.student-add-head{color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.student-add-row input{margin:0}.row-remove-btn{width:38px;height:38px;border:0;border-radius:10px;background:#fee2e2;color:#b91c1c;font-size:22px;font-weight:900;cursor:pointer}.row-remove-btn:disabled{opacity:.45;cursor:not-allowed}.add-row-btn{margin-top:14px}.modal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(2,6,23,.62);padding:18px}.class-modal{width:min(560px,100%);border:1px solid #dbe3ef;border-radius:18px;background:#fff;color:#0f172a;padding:22px;box-shadow:0 24px 80px rgba(2,6,23,.35)}.modal-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}.modal-head p{margin:0 0 6px;color:#1976d2;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.modal-head h2{margin:0;font-size:22px}.icon-btn{width:38px;height:38px;border:0;border-radius:999px;background:#eef2ff;color:#0f172a;font-size:24px;cursor:pointer}.class-modal label{display:grid;gap:8px;margin-top:14px;color:#475569;font-size:13px;font-weight:800}.class-modal label span{color:#dc2626}.class-modal input,.class-modal textarea,.class-modal select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;padding:12px 13px;font:inherit;font-weight:600;outline:0;appearance:auto}.class-modal input:focus,.class-modal textarea:focus,.class-modal select:focus{border-color:#1976d2;box-shadow:0 0 0 3px rgba(25,118,210,.14)}.class-modal input[type=file]{cursor:pointer;background:#f8fafc}.class-modal input[type=file]::file-selector-button{border:0;border-radius:8px;background:#1976d2;color:#fff;font-weight:800;padding:9px 12px;margin-right:12px;cursor:pointer}.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.modal-note{margin:14px 0 0;color:#64748b;font-size:13px}.form-error{margin:14px 0 0;border-radius:10px;background:#fee2e2;color:#b91c1c;padding:10px 12px;font-size:13px;font-weight:700}.modal-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}.ghost-btn{border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font-weight:800;padding:11px 18px;cursor:pointer}.modal-submit{min-height:42px;border-radius:10px}.ghost-btn:disabled,.modal-submit:disabled{cursor:not-allowed;opacity:.65}.dark .classes-page{background:#0b1020;color:#f8fafc}.dark .hero{background:#020617;box-shadow:0 8px 24px rgba(0,0,0,.45)}.dark .content{color:#f8fafc}.dark .tabs{border-bottom-color:#334155}.dark .tabs button{color:#94a3b8}.dark .tabs button.active{color:#60a5fa;border-bottom-color:#60a5fa}.dark .search,.dark .select-label,.dark .subject-display{border-color:#334155;background:#111827;color:#e5e7eb}.dark .search input::placeholder{color:#94a3b8}.dark .subject-display strong{color:#f8fafc}.dark .table-empty{color:#cbd5e1}.dark .primary-btn,.dark .create-class-btn{background:#2563eb;color:#fff}.dark .delete-class-btn,.dark .danger-btn{background:#dc2626;color:#fff}.dark .delete-warning{background:#3f1d24;color:#fecaca}.dark .student-card,.dark .table-wrap,.dark .stat-card,.dark .empty-card,.dark .hub-empty-state{background:#111827;border-color:#1f2937;box-shadow:0 2px 10px rgba(0,0,0,.35)}.dark .student-info p,.dark .stat-card p,.dark .empty-card p,.dark .hub-empty-state p,.dark .empty-line{color:#cbd5e1}.dark .card-head span{background:#15803d}.dark .avatar{background:#2563eb}.dark .empty-line{border-color:#334155;background:#111827}.dark table{background:#111827;color:#f8fafc}.dark th,.dark td{border-bottom-color:#263244}.dark .avg{background:#0f172a;color:#60a5fa}.dark .avg-head{background:#2563eb;color:#fff}.dark .class-select select{background:#111827;border-color:#334155;color:#f8fafc}.dark .row-remove-btn{background:#3f1d24;color:#fca5a5}.dark .hub-empty-state h1{color:#f8fafc}.dark .tile-menu-popover{background:#111827;border-color:#334155}.dark .tile-menu-popover button{color:#e5e7eb}.dark .tile-menu-popover button:hover{background:#1e293b}.dark .tile-menu-popover .delete-menu-item{color:#fca5a5}.dark .tile-menu-popover .delete-menu-item:hover{background:#3f1d24}.dark .settings-section{border-color:#334155;background:#0f172a}.dark .settings-danger-row strong{color:#f8fafc}.dark .settings-danger-row p{color:#cbd5e1}.dark .student-add-head{color:#cbd5e1}.dark .class-modal{background:#111827;color:#f8fafc;border-color:#334155}.dark .modal-head p{color:#60a5fa}.dark .icon-btn{background:#1f2937;color:#f8fafc}.dark .class-modal label{color:#cbd5e1}.dark .class-modal input,.dark .class-modal textarea,.dark .class-modal select{border-color:#334155;background:#0f172a;color:#f8fafc}.dark .class-modal input[type=file]{background:#0f172a}.dark .modal-note{color:#cbd5e1}.dark .ghost-btn{border-color:#334155;background:#0f172a;color:#f8fafc}.dark .green{color:#22c55e}.dark .red{color:#f87171}.dark .blue{color:#60a5fa}.dark .purple{color:#a78bfa}@media (prefers-color-scheme: dark){.classes-page{background:#0b1020;color:#f8fafc}.hero{background:#020617;box-shadow:0 8px 24px rgba(0,0,0,.45)}.content{color:#f8fafc}.tabs{border-bottom-color:#334155}.tabs button{color:#94a3b8}.tabs button.active{color:#60a5fa;border-bottom-color:#60a5fa}.search,.select-label,.subject-display{border-color:#334155;background:#111827;color:#e5e7eb}.search input::placeholder{color:#94a3b8}.subject-display strong{color:#f8fafc}.table-empty{color:#cbd5e1}.primary-btn,.create-class-btn{background:#2563eb;color:#fff}.student-card,.table-wrap,.stat-card,.empty-card{background:#111827;border-color:#1f2937;box-shadow:0 2px 10px rgba(0,0,0,.35)}.student-info p,.stat-card p,.empty-card p,.empty-line{color:#cbd5e1}.card-head span{background:#15803d}.avatar{background:#2563eb}.empty-line{border-color:#334155;background:#111827}table{background:#111827;color:#f8fafc}th,td{border-bottom-color:#263244}.avg{background:#0f172a;color:#60a5fa}.avg-head{background:#2563eb;color:#fff}.class-select select{background:#111827;border-color:#334155;color:#f8fafc}.green{color:#22c55e}.red{color:#f87171}.blue{color:#60a5fa}.purple{color:#a78bfa}}
.dark .class-hub-page{background:#0b1020;color:#f8fafc}.dark .hub-action-card{box-shadow:0 1px 12px rgba(0,0,0,.35)}.dark .play-preview{background:rgba(15,23,42,.65);border-color:#334155;color:#93c5fd}.dark .class-tile{background:#111827;border-color:#1f2937;box-shadow:0 4px 14px rgba(0,0,0,.35)}.dark .class-tile:hover{box-shadow:0 12px 26px rgba(0,0,0,.5)}.dark .class-tile-body h3{color:#f8fafc}.dark .class-tile-body p{color:#cbd5e1}.dark .class-icon{background:#1e3a8a;color:#bfdbfe}.dark .tile-menu{color:#cbd5e1}.dark .tile-edit-btn{background:rgba(15,23,42,.9);color:#e5e7eb}.dark .tile-edit-btn:hover{background:#1e293b;color:#60a5fa}.dark .settings-preview{background:#0f172a;border-color:#334155}.dark .preview-logo{border-color:#111827}@media (prefers-color-scheme: dark){.class-hub-page{background:#0b1020;color:#f8fafc}.play-preview{background:rgba(15,23,42,.65);border-color:#334155;color:#93c5fd}.hub-empty-state{background:#111827;border-color:#1f2937;box-shadow:0 2px 10px rgba(0,0,0,.35)}.hub-empty-state h1{color:#f8fafc}.hub-empty-state p{color:#cbd5e1}.class-tile{background:#111827;border-color:#1f2937;box-shadow:0 4px 14px rgba(0,0,0,.35)}.class-tile-body h3{color:#f8fafc}.class-tile-body p{color:#cbd5e1}.class-icon{background:#1e3a8a;color:#bfdbfe}.tile-menu-popover{background:#111827;border-color:#334155}.tile-menu-popover button{color:#e5e7eb}.tile-menu-popover button:hover{background:#1e293b}.tile-menu-popover .delete-menu-item{color:#fca5a5}.tile-menu-popover .delete-menu-item:hover{background:#3f1d24}.settings-section{border-color:#334155;background:#0f172a}.settings-danger-row strong{color:#f8fafc}.settings-danger-row p{color:#cbd5e1}.tile-menu{color:#cbd5e1}}
.skeleton-tile{pointer-events:none;cursor:default}.skeleton-cover{height:142px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}.skeleton-line{border-radius:6px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}.skeleton-title{height:18px;width:60%;margin-bottom:10px}.skeleton-sub{height:14px;width:80%}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.dark .skeleton-cover,.dark .skeleton-line{background:linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}@media (max-width:1100px){.class-card-grid{grid-template-columns:repeat(3,minmax(190px,1fr))}.hub-top{grid-template-columns:1fr}.class-tabs{gap:22px;overflow-x:auto}.class-tabs button{white-space:nowrap}}@media (max-width:920px){.settings-danger-row{align-items:flex-start;flex-direction:column}.settings-danger-row .danger-btn{width:100%}}@media (max-width:920px){.hero{padding:24px}.hero-actions{align-items:flex-start;flex-direction:column}.student-grid{grid-template-columns:1fr 1fr}.summary-grid{grid-template-columns:1fr 1fr}.toolbar{flex-direction:column}.primary-btn{min-height:48px}.hero-stats{gap:24px}}@media (max-width:640px){.class-card-grid{grid-template-columns:1fr}.hub-top,.class-hub{padding-left:16px;padding-right:16px}.hub-action-card{padding:18px;min-height:86px}.modal-grid{grid-template-columns:1fr}.modal-actions{flex-direction:column}.ghost-btn,.modal-submit,.danger-btn{width:100%;min-height:44px}.student-grid{grid-template-columns:1fr}.hero{height:auto;align-items:flex-start;flex-direction:column}.table-wrap{overflow-x:auto}.summary-grid{grid-template-columns:1fr}}
`;


function Classes() {
  const { userDetails } = useAuth();

  if (userDetails?.role === 'STUDENT') {
    return (
      <MaintenanceState
        badge="Lớp học"
        title="Tính năng đang bảo trì"
        subtitle="Lớp học dành cho học sinh đang được phát triển"
        description="Chúng tôi đang hoàn thiện trải nghiệm lớp học. Vui lòng quay lại trong thời gian sớm nhất."
      />
    );
  }

  return <TeacherClasses />;
}

export default Classes;
