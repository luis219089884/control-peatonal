export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        uagrm: {
          blue:      '#1a3a6b',
          blueDark:  '#0f2347',
          blueLight: '#2a5298',
          red:       '#c0392b',
          redDark:   '#922b21',
          light:     '#f5f7fa',
          gray:      '#e8ecf0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 2px 12px rgba(0,0,0,0.08)',
        panel: '0 4px 24px rgba(0,0,0,0.12)',
      }
    }
  },
  plugins: []
}
