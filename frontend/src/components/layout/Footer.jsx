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
  { label: 'E-learning', href: '/courses' },
  { label: 'Cộng đồng', href: '/Forum' },
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

            {/* Logo giống Navbar */}
            <div className="rounded-md bg-gradient-to-r from-cyan-400 to-blue-500 p-[2px] shadow-lg">
              <img
                src={
                  darkMode
                    ? darkLogo
                    : lightLogo
                }
                alt="logo"
                className="h-9 w-9 rounded-sm object-cover"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                ZUNY
              </h1>

              <p className="text-xs font-medium text-cyan-500">
                THPT Platform
              </p>
            </div>

          </Link>

          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
           Nền tảng luyện thi hiện đại tích hợp thư viện học liệu,
            giao diện kiểm tra trực tuyến, cộng đồng học tập, 
            bảng xếp hạng trực quan và AI phân tích hành vi, 
            giúp học sinh học hiệu quả hơn và hỗ trợ giáo viên đánh giá khách quan hơn.


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
              zero169209@gmail.com / namvnups@gmail.com
            </p>

            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-cyan-500" />
              0938 213 826 / 0936 273 869
            </p>

            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cyan-500" />
              Việt Nam
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