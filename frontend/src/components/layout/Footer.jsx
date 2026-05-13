import { Link } from 'react-router-dom'

import {
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
 Send,
} from 'lucide-react'

import darkLogo from '../../assets/favicon-dark-mode.png'
import lightLogo from '../../assets/favicon-light-mode.png'

const quickLinks = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Kho đề thi', href: '/exams' },
  { label: 'E-Learning', href: '/courses' },
  { label: 'Bảng xếp hạng', href: '/leaderboard' },
  { label: 'Dashboard', href: '/dashboard' },
]

function Footer({ darkMode }) {
  return (
    <footer className="mt-16 border-t border-white/60 bg-white/70 px-4 py-12 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55 sm:px-6 lg:px-8">

      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">

        <div>

          <Link
            to="/"
            className="mb-4 flex items-center gap-3"
          >

            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 p-2">

              <img
                src={
                  darkMode
                    ? darkLogo
                    : lightLogo
                }
                alt="EduSprint Logo"
                className="h-full w-full rounded-xl object-contain"
              />

            </span>

            <span className="text-xl font-black text-slate-950 dark:text-white">
              EduSprint
            </span>

          </Link>

          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
            Nền tảng luyện thi và E-Learning hiện đại cho học sinh
            THPT, tập trung vào trải nghiệm thi online, tiến độ học
            tập và phân tích năng lực trực quan.
          </p>

          <div className="mt-5 flex gap-2">
            {[Globe2, MessageCircle, Send].map((Icon, index) => (
              <a
                key={index}
                href="#"
                className="rounded-lg border border-cyan-300/25 p-2.5 text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-200"
                aria-label="Social link"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>

        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-950 dark:text-white">
            Liên kết nhanh
          </h3>

          <div className="grid gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-sm font-medium text-slate-600 transition hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-200"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-950 dark:text-white">
            Liên hệ
          </h3>

          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">

            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-cyan-500" />
              hello@edusprint.vn
            </p>

            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-cyan-500" />
              024 8888 2026
            </p>

            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cyan-500" />
              Hà Nội, Việt Nam
            </p>

          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-950 dark:text-white">
            Chính sách
          </h3>

          <div className="grid gap-2">
            {[
              'Điều khoản sử dụng',
              'Quyền riêng tư',
              'Hỗ trợ học sinh',
            ].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm font-medium text-slate-600 transition hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-200"
              >
                {item}
              </a>
            ))}
          </div>
        </div>

      </div>

      <div className="mx-auto mt-10 flex max-w-7xl items-center justify-center border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">

        <p>
          © 2026 Bản quyền thuộc về Zero BlackWolf.
        </p>

      </div>

    </footer>
  )
}

export default Footer