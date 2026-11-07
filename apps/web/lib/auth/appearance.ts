// CSS variables, so Clerk follows the theme with no separate dark appearance.
//
// Clerk colors its links with `colorPrimary`, and gold text on white fails the
// §13 gold rule. So `colorPrimary` is the text color, and only the main button
// is gold, with navy text.
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-text)",
    colorPrimaryForeground: "var(--color-background)",
    colorBackground: "var(--color-surface)",
    colorForeground: "var(--color-text)",
    colorMutedForeground: "var(--color-text-secondary)",
    colorInput: "var(--color-background)",
    colorInputForeground: "var(--color-text)",
    colorNeutral: "var(--color-text)",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    // Email and password are Latin text inside an RTL page. This sets each
    // input's direction from its content, so a long email doesn't lose its start.
    formFieldInput: {
      unicodeBidi: "plaintext",
      textAlign: "start",
    },
    // A long email in Clerk's identity line loses its start the same way.
    identityPreviewText: {
      unicodeBidi: "plaintext",
    },
    // A code is read left to right, even in Arabic. In RTL, 123 shows as 321.
    otpCodeFieldInputs: {
      direction: "ltr",
    },
    formButtonPrimary: {
      backgroundColor: "var(--color-accent)",
      color: "var(--color-on-accent)",
      "&:hover, &:focus, &:active": {
        backgroundColor: "var(--color-accent)",
        opacity: 0.9,
      },
    },
  },
};
