import { Link } from 'react-router-dom'
import { Brain, BarChart3, Shield, Zap, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#111111] antialiased">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#111111] rounded-lg flex items-center justify-center text-white">
            <Brain className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-[#111111] tracking-tight">AttritionIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-xs font-medium text-[#666666] hover:text-[#111111] px-3 py-1.5 transition-colors">Log in</Link>
          <Link to="/signup" className="btn-primary text-xs px-3.5 py-1.5">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F7F7F7] text-[#111111] rounded-full text-xs font-medium mb-8 border border-border">
          <Zap className="w-3.5 h-3.5 text-[#111111]" />
          <span>ML-Powered HR Risk Intelligence</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#111111] tracking-tight max-w-4xl mx-auto leading-[1.1]">
          Predict Employee Attrition <br className="hidden sm:inline" />
          <span className="text-[#666666]">Before It Happens</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-[#666666] max-w-2xl mx-auto leading-relaxed">
          An enterprise platform combining machine learning predictions,
          SHAP explainability, and AI-powered insights to help retention strategies.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <Link to="/signup" className="btn-primary text-sm px-6 py-2.5 flex items-center gap-2">
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/login" className="btn-secondary text-sm px-6 py-2.5">Sign In</Link>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: Brain,
              title: 'ML Predictions',
              desc: 'Logistic Regression model trained on benchmark HR data with SHAP explainability for every prediction.',
            },
            {
              icon: BarChart3,
              title: 'HR Analytics',
              desc: 'Visual dashboards showing attrition risk breakdown by department, job role, overtime, and satisfaction scores.',
            },
            {
              icon: Shield,
              title: 'AI HR Assistant',
              desc: 'AI-powered assistant explains predictions and suggests constructive employee retention strategies.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card text-left p-6">
              <div className="w-9 h-9 bg-[#F7F7F7] border border-border rounded-lg flex items-center justify-center mb-4 text-[#111111]">
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-[#111111] text-sm mb-1.5">{title}</h3>
              <p className="text-xs text-[#666666] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
