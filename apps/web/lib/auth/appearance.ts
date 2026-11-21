// Clerk's sign-in and sign-up, themed with the record's tokens (DESIGN.md,
// the SignIn board). Every value is a CSS variable, so Clerk follows the
// light and dark theme with no second appearance.
//
// Kept from Phase 1:
// - Links stay ink, not accent: Clerk colors its links with `colorPrimary`,
//   so `colorPrimary` is the ink and only the main button takes the accent.
// - Email and password inputs set their direction from their content, the
//   identity line too, and code boxes read left to right in Arabic.

/** The main button, as the Button board's primary: accent, then ink on hover and press. */
const primaryButtonActive = {
  backgroundColor: "var(--ink)",
  color: "var(--bg)",
};

/** The one focus ring of the system: 2px, offset 3px, solid. */
const focusRing = {
  outline: "2px solid var(--focus)",
  outlineOffset: "3px",
  boxShadow: "none",
};

export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--ink)",
    colorPrimaryForeground: "var(--bg)",
    colorBackground: "var(--bg)",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--ink-2)",
    colorMuted: "var(--surface)",
    colorInput: "var(--bg)",
    colorInputForeground: "var(--ink)",
    colorNeutral: "var(--ink)",
    colorBorder: "var(--line)",
    colorDanger: "var(--danger)",
    colorSuccess: "var(--success)",
    colorWarning: "var(--warning)",
    colorRing: "var(--focus)",
    colorModalBackdrop: "var(--scrim)",
    // Square everywhere (DESIGN.md "Space and layout"). A length with its unit, as Clerk computes from it.
    borderRadius: "0rem",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    // The card reads like the record: the 2px rule on top, hairline sides, no shadow.
    cardBox: {
      boxShadow: "none",
      borderRadius: "0",
    },
    card: {
      boxShadow: "none",
      borderRadius: "0",
      border: "1px solid var(--line)",
      borderTop: "2px solid var(--rule)",
      background: "var(--bg)",
    },
    // Clerk paints the card footer with its own grey; ours is the raised ground.
    footer: {
      background: "var(--surface)",
      borderRadius: "0",
    },
    headerTitle: {
      fontWeight: 500,
    },
    // Email and password are Latin text inside an RTL page. This sets each
    // input's direction from its content, so a long email doesn't lose its start.
    formFieldInput: {
      unicodeBidi: "plaintext",
      textAlign: "start",
      borderColor: "var(--line-strong)",
      boxShadow: "none",
      "&:focus": focusRing,
    },
    // A long email in Clerk's identity line loses its start the same way.
    identityPreviewText: {
      unicodeBidi: "plaintext",
    },
    // A code is read left to right, even in Arabic. In RTL, 123 shows as 321.
    otpCodeFieldInputs: {
      direction: "ltr",
    },
    socialButtonsBlockButton: {
      boxShadow: "none",
      border: "1px solid var(--line-strong)",
      "&:focus": focusRing,
    },
    // One key per state. Clerk reads a space inside a nested selector as a
    // descendant combinator and logs its "Structural CSS" warning, so the
    // comma list "&:hover, &:focus, &:active" trips it. A single state doesn't.
    formButtonPrimary: {
      backgroundColor: "var(--accent)",
      color: "var(--on-accent)",
      boxShadow: "none",
      "&:hover": primaryButtonActive,
      "&:active": primaryButtonActive,
      "&:focus": focusRing,
    },
  },
};
