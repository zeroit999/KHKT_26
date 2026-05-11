import { Link } from 'react-router-dom'
import { Home, SearchX } from 'lucide-react'
import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'

function NotFound() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <GlassCard className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-600 dark:text-cyan-200">
          <SearchX className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-black text-slate-950 dark:text-white">Không tìm thấy trang</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Đường dẫn này chưa có trong giao diện demo.</p>
        <Link to="/" className="mt-7 inline-flex">
          <GradientButton icon={Home}>Về trang chủ</GradientButton>
        </Link>
      </GlassCard>
    </section>
  )
}

export default NotFound
