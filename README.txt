TOKI MATCH 改訂版

GitHubのリポジトリのルートに index.html / netlify.toml / package.json / netlify/functions/chat.mjs を上書きアップロードしてください。
Netlifyの環境変数 GEMINI_API_KEY は維持してください。

変更内容：初回6問の好み登録を維持（同じブラウザで登録済みならスキップ）、人物の自己紹介をマッチングアプリ風に、AI会話履歴の復元、1人20通/日・サイト全体400リクエスト/日（UTC日付）。

重要：Netlify Blobsのカウンターは同時アクセス時の原子的な加算を保証しないため、サイト全体400回は厳密な上限ではありません。確実な課金上限にはGoogle側の課金・クォータ設定や原子的なカウンタを持つデータベースが必要です。Gemini APIの利用制限はプロジェクト全体で共有されます。
