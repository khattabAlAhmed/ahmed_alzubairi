// CSS variables, so Clerk follows the theme with no separate dark appearance.
//
// Clerk colors its links with `colorPrimary`, and gold text on white fails the
// §13 gold rule. So `colorPrimary` is the text color, and only the main button
// is gold, with navy text.

// The main button stays gold in every state and dims a little. Without the
// background here, Clerk paints its own hover shade of `colorPrimary`.
const primaryButtonState = {
  backgroundColor: "var(--color-accent)",
  opacity: 0.9,
};

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
    // Clerk paints the card footer with its own cool grey in the light theme,
    // which looks off-palette next to the ivory page. Light uses our ivory
    // instead. Dark already reads well, so it keeps Clerk's tint.
    footer: {
      "html:not(.dark) &": {
        background: "var(--color-background)",
      },
    },
    // One key per state. Clerk reads a space inside a nested selector as a
    // descendant combinator and logs its "Structural CSS" warning, so the
    // comma list "&:hover, &:focus, &:active" trips it. A single state doesn't.
    formButtonPrimary: {
      backgroundColor: "var(--color-accent)",
      color: "var(--color-on-accent)",
      "&:hover": primaryButtonState,
      "&:focus": primaryButtonState,
      "&:active": primaryButtonState,
    },
  },
};
