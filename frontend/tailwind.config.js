/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        background: '#FFFFFF',
        surface: {
          DEFAULT: '#FFFFFF',
          light: '#F7F7F7',
          hover: '#F2F2F2',
          subtle: '#FAFAFA',
          muted: '#EAEAEA',
        },
        border: {
          DEFAULT: '#E5E5E5',
          border: '#E5E5E5',
          subtle: '#F0F0F0',
          dark: '#DCDCDC',
        },
        primary: {
          DEFAULT: '#111111',
          hover: '#262626',
          active: '#000000',
        },
        // brand mapped to crisp enterprise monochromatic scale with dark primary
        brand: {
          50: '#F7F7F7',
          100: '#F2F2F2',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#525252',
          600: '#111111',
          700: '#171717',
          800: '#0A0A0A',
          900: '#000000',
        },
      },
      borderColor: {
        DEFAULT: '#E5E5E5',
        border: '#E5E5E5',
        subtle: '#F0F0F0',
        dark: '#DCDCDC',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        input: '8px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 2px 8px 0 rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
