import { render, screen } from '@testing-library/react'
import { StatCard } from '../StatCard'

describe('StatCard', () => {
  const mockIcon = <svg data-testid="test-icon">Icon</svg>

  it('タイトルと値を正しく表示する', () => {
    render(
      <StatCard
        title="テストタイトル"
        value="100"
        icon={mockIcon}
        gradient="bg-gradient-to-r from-blue-500 to-purple-500"
      />
    )

    expect(screen.getByText('テストタイトル')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('トレンド情報が表示される', () => {
    render(
      <StatCard
        title="テストタイトル"
        value="100"
        icon={mockIcon}
        gradient="bg-gradient-to-r from-blue-500 to-purple-500"
        trend={{ value: '+10%', isPositive: true }}
      />
    )

    expect(screen.getByText('+10%')).toBeInTheDocument()
  })

  it('数値の値も正しく表示される', () => {
    render(
      <StatCard
        title="テストタイトル"
        value={42}
        icon={mockIcon}
        gradient="bg-gradient-to-r from-blue-500 to-purple-500"
      />
    )

    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('トレンドが負の値の場合も正しく表示される', () => {
    render(
      <StatCard
        title="テストタイトル"
        value="100"
        icon={mockIcon}
        gradient="bg-gradient-to-r from-blue-500 to-purple-500"
        trend={{ value: '-5%', isPositive: false }}
      />
    )

    expect(screen.getByText('-5%')).toBeInTheDocument()
  })
})

