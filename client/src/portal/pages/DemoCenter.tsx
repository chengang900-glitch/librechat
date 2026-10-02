/* eslint-disable i18next/no-literal-string -- This fixed Chinese dashboard is explicitly demonstration content. */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Download,
  Factory,
  Gauge,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { useGetStartupConfig } from '~/data-provider';

type CenterKind = 'data';

const DATA_SECTIONS = [
  { name: '经营驾驶舱', icon: Target, children: ['核心指标', '预警中心', '目标达成'] },
  { name: '销售与回款', icon: CircleDollarSign, children: ['订单分析', '客户结构', '回款与账龄'] },
  { name: '供应链与库存', icon: Truck, children: ['采购执行', '库存健康度', '供应商绩效'] },
  { name: '生产制造', icon: Factory, children: ['工单进度', '产能利用', '设备 OEE'] },
  { name: '财务与成本', icon: BarChart3, children: ['利润表', '成本结构', '预算执行'] },
  { name: '质量与售后', icon: ShieldCheck, children: ['合格率', '客诉与退货'] },
  { name: '人力效能', icon: Users, children: ['人效指标', '编制与离职'] },
];

const KPIS = [
  {
    name: '营业收入',
    value: '4,286.5',
    unit: '万元',
    delta: '+12.4%',
    good: true,
    target: '目标 4,600 万',
    rate: '达成 93.2%',
  },
  {
    name: '毛利率',
    value: '23.8',
    unit: '%',
    delta: '-1.6pt',
    good: false,
    target: '阈值 ≥ 25.5%',
    rate: '偏差 -1.7pt',
  },
  {
    name: '订单交付准时率',
    value: '86.2',
    unit: '%',
    delta: '-5.1pt',
    good: false,
    target: '阈值 ≥ 92%',
    rate: '偏差 -5.8pt',
  },
  {
    name: '库存周转天数',
    value: '47',
    unit: '天',
    delta: '+6',
    good: false,
    target: '阈值 ≤ 42 天',
    rate: '偏差 +5 天',
  },
  {
    name: '应收账款 DSO',
    value: '62',
    unit: '天',
    delta: '+3',
    good: false,
    target: '阈值 ≤ 55 天',
    rate: '偏差 +7 天',
  },
];

const ALERTS = [
  ['订单交付准时率', '供应链', '86.2%', '≥ 92%', '-5.8pt', '周敏'],
  ['库存周转天数', '供应链', '47 天', '≤ 42 天', '+5 天', '李国栋'],
  ['应收账款 DSO', '财务', '62 天', '≤ 55 天', '+7 天', '张予彤'],
  ['毛利率', '财务', '23.8%', '≥ 25.5%', '-1.7pt', '张三'],
];

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      演示数据
    </span>
  );
}

function DataCenter() {
  const [section, setSection] = useState('核心指标');
  return (
    <div className="flex h-full min-h-0 bg-surface-primary">
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border-light bg-surface-secondary p-3 dark:border-border-medium lg:block">
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
          数据主题
        </p>
        {DATA_SECTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.name} className="mb-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-surface-tertiary"
              >
                <Icon className="h-4 w-4 text-blue-600" />
                <span className="flex-1">{item.name}</span>
                {index < 5 && <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />}
              </button>
              {item.children.map((child) => (
                <button
                  type="button"
                  key={child}
                  onClick={() => setSection(child)}
                  className={`ml-6 block w-[calc(100%-1.5rem)] rounded-lg px-3 py-1.5 text-left text-xs transition ${section === child ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'}`}
                >
                  {child}
                </button>
              ))}
            </div>
          );
        })}
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-surface-primary p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <DemoBadge />
                <span className="text-xs text-text-secondary">数据截止 2026-08-31 08:00</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                经营驾驶舱
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                聚合财务、供应链与制造指标，辅助经营决策
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-medium px-3 text-sm text-text-secondary hover:bg-surface-secondary"
              >
                <RefreshCw className="h-4 w-4" />
                刷新
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-medium px-3 text-sm text-text-secondary hover:bg-surface-secondary"
              >
                <Download className="h-4 w-4" />
                导出
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {KPIS.map((kpi) => (
              <article
                key={kpi.name}
                className="rounded-2xl border border-border-light bg-surface-primary p-4 shadow-sm dark:border-border-medium"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-text-secondary">{kpi.name}</p>
                  {kpi.good ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <strong className="text-2xl font-semibold tracking-tight text-text-primary">
                    {kpi.value}
                  </strong>
                  <span className="text-xs text-text-secondary">{kpi.unit}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={kpi.good ? 'text-green-600' : 'text-amber-600'}>
                    {kpi.delta} 同比
                  </span>
                  <span className="text-text-secondary">{kpi.rate}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                  <div
                    className={`h-full rounded-full ${kpi.good ? 'w-[93%] bg-green-500' : 'w-[72%] bg-amber-500'}`}
                  />
                </div>
                <p className="mt-2 text-[11px] text-text-secondary">{kpi.target}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <article className="rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm dark:border-border-medium">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-text-primary">营业收入与毛利趋势</h2>
                  <p className="mt-1 text-xs text-text-secondary">2026 年月度趋势（万元 / %）</p>
                </div>
                <Gauge className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-6 h-64 rounded-xl bg-gradient-to-b from-blue-50/70 to-transparent p-4 dark:from-blue-950/30">
                <svg
                  viewBox="0 0 760 220"
                  className="h-full w-full"
                  role="img"
                  aria-label="营业收入与毛利趋势演示图"
                >
                  {[40, 85, 130, 175].map((y) => (
                    <line
                      key={y}
                      x1="30"
                      y1={y}
                      x2="735"
                      y2={y}
                      stroke="currentColor"
                      className="text-border-light"
                      strokeWidth="1"
                    />
                  ))}
                  <path
                    d="M35 168 C90 150 120 164 175 130 S260 105 315 115 S400 74 455 88 S545 48 600 67 S680 40 730 55"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M35 82 C95 77 120 90 175 88 S265 100 315 112 S405 118 455 132 S550 130 600 148 S680 145 730 155"
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="3"
                    strokeDasharray="7 7"
                    strokeLinecap="round"
                  />
                  {['1月', '3月', '5月', '7月', '9月', '11月'].map((m, i) => (
                    <text
                      key={m}
                      x={35 + i * 139}
                      y="210"
                      fill="currentColor"
                      className="text-text-secondary"
                      fontSize="12"
                    >
                      {m}
                    </text>
                  ))}
                </svg>
              </div>
              <div className="mt-2 flex gap-5 text-xs text-text-secondary">
                <span className="flex items-center gap-2">
                  <i className="h-0.5 w-5 bg-blue-600" />
                  营业收入
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-0.5 w-5 border-t-2 border-dashed border-amber-600" />
                  毛利率
                </span>
              </div>
            </article>
            <article className="rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm dark:border-border-medium">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-text-primary">业务健康度</h2>
                  <p className="mt-1 text-xs text-text-secondary">关键领域综合评分</p>
                </div>
                <PackageCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-5 space-y-4">
                {[
                  ['销售与回款', 88, 'bg-blue-500'],
                  ['供应链与库存', 64, 'bg-amber-500'],
                  ['生产制造', 76, 'bg-cyan-600'],
                  ['质量与售后', 92, 'bg-green-600'],
                  ['财务与成本', 71, 'bg-orange-500'],
                ].map(([name, score, color]) => (
                  <div key={String(name)}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-text-secondary">{name}</span>
                      <b className="text-text-primary">{score}</b>
                    </div>
                    <div className="h-2 rounded-full bg-surface-tertiary">
                      <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <article className="mt-4 overflow-hidden rounded-2xl border border-border-light bg-surface-primary shadow-sm dark:border-border-medium">
            <div className="flex items-center justify-between border-b border-border-light px-5 py-4 dark:border-border-medium">
              <div>
                <h2 className="font-semibold text-text-primary">指标预警</h2>
                <p className="mt-1 text-xs text-text-secondary">需要关注的经营异常</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-secondary text-xs text-text-secondary">
                  <tr>
                    {['指标', '领域', '当前值', '阈值', '偏差', '负责人', '状态'].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALERTS.map((row, i) => (
                    <tr
                      key={row[0]}
                      className="border-t border-border-light dark:border-border-medium"
                    >
                      <td className="px-5 py-3 font-medium text-text-primary">{row[0]}</td>
                      {row.slice(1).map((cell) => (
                        <td key={cell} className="px-5 py-3 text-text-secondary">
                          {cell}
                        </td>
                      ))}
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${i === 0 ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}
                        >
                          {i === 0 ? '紧急' : '关注'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}

export default function PortalDemoCenter(_props: { kind: CenterKind }) {
  const configQuery = useGetStartupConfig();
  if (configQuery.isLoading) return null;
  if (!configQuery.data?.portal?.enabled) return <Navigate to="/c/new" replace />;
  return <DataCenter />;
}
