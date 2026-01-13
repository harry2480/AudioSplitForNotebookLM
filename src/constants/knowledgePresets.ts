import type { KnowledgePreset } from '../hooks/useKnowledgePresets';

export const defaultKnowledgePresets: KnowledgePreset[] = [
  {
    id: 'sales_meeting',
    name: '商談の背景',
    description: '提案中のプロジェクトや意思決定者など、B2B商談の定番情報',
    content: `案件種別: 既存顧客への継続提案（サブスクリプション更新）
意思決定者: 情シス部長の佐藤様、実務担当の鈴木様
目的: 追加ライセンス導入の可否判断と年間契約の条件確認
重要視点: 導入効果の再提示、価格交渉の余地、競合比較ポイント`,
  },
  {
    id: 'internal_meeting',
    name: '社内定例会議',
    description: '部門横断の週次・月次ミーティングで共有される背景情報',
    content: `会議種別: プロダクト部門の週次定例
参加部署: 開発、営業、サポート、CS
目的: リリース状況の共有、KPI進捗レビュー、各部からの課題共有
前提: 直近でバージョン2.3をリリース済み。次期大型アップデートの要件確認が必要`,
  },
  {
    id: 'support_review',
    name: 'サポート振り返り',
    description: '顧客サポートの問い合わせ分析や改善検討の背景',
    content: `対象期間: 直近1か月
主要指標: 初回応答時間、解決までの平均時間、CSATスコア
観点: エスカレーションが増えている製品領域、ナレッジ不足のトピック、改善予定のワークフロー`,
  },
  {
    id: 'project_kickoff',
    name: 'プロジェクトキックオフ',
    description: '新規プロジェクト開始時に共有される基本情報',
    content: `プロジェクト名: Next Vision
期間: 2024年4月〜2024年9月（6か月）
体制: PM 1名 / エンジニア 4名 / デザイナー 1名 / QA 1名
ゴール: AI要約機能付きノートアプリのβ版公開
成功条件: βユーザー300社、NPS +20、主要KPIのトラッキング体制構築`,
  },
];
