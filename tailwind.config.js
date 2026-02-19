/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bb: {
          primary:          "var(--bb-primary)",
          "primary-hover":  "var(--bb-primary-hover)",
          "primary-light":  "var(--bb-primary-light)",
          "primary-border": "var(--bb-primary-border)",
          secondary:        "var(--bb-secondary)",
          "text-secondary": "var(--bb-text-secondary)",
          "text-tertiary":  "var(--bb-text-tertiary)",
          "text-muted":     "var(--bb-text-muted)",
          border:           "var(--bb-border)",
          "border-subtle":  "var(--bb-border-subtle)",
          "border-input":   "var(--bb-border-input)",
          "bg-page":        "var(--bb-bg-page)",
          "bg-warm":        "var(--bb-bg-warm)",
          "bg-card":        "var(--bb-bg-card)",
          "info-bg":        "var(--bb-info-bg)",
          "info-text":      "var(--bb-info-text)",
          "info-border":    "var(--bb-info-border)",
          "success-bg":     "var(--bb-success-bg)",
          "success-text":   "var(--bb-success-text)",
          "success-border": "var(--bb-success-border)",
          "warning-bg":     "var(--bb-warning-bg)",
          "warning-text":   "var(--bb-warning-text)",
          "warning-border": "var(--bb-warning-border)",
          "danger-bg":      "var(--bb-danger-bg)",
          "danger-text":    "var(--bb-danger-text)",
          "danger-border":  "var(--bb-danger-border)",
        },
      },
    },
  },
  plugins: [],
};
