// Clerk's sign-in and sign-up, themed with the record's tokens (DESIGN.md,
// the SignIn board). Every value is a CSS variable, so Clerk follows the
// light and dark theme with no second appearance.
//
// The tokens are read by their `--color-*` names. Clerk sets its own
// `--accent` and `--focus` on its buttons, so `var(--accent)` inside Clerk
// is Clerk's colour, not ours. The `--color-*` names are resolved on :root.
//
// Kept from Phase 1:
// - Links stay ink, not accent: Clerk colors its links with `colorPrimary`,
//   so `colorPrimary` is the ink and only the main button takes the accent.
// - Email and password inputs set their direction from their content, the
//   identity line too, and code boxes read left to right in Arabic.

/** The main button, as the Button board's primary: accent, then ink on hover and press. */
const primaryButtonActive = {
  backgroundColor: "var(--color-ink)",
  backgroundImage: "none",
  color: "var(--color-bg)",
};

/** The one focus ring of the system: 2px, offset 3px, solid. */
const focusRing = {
  outline: "2px solid var(--color-focus)",
  outlineOffset: "3px",
  boxShadow: "none",
};

export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-ink)",
    colorPrimaryForeground: "var(--color-bg)",
    colorBackground: "var(--color-bg)",
    colorForeground: "var(--color-ink)",
    colorMutedForeground: "var(--color-ink-2)",
    colorMuted: "var(--color-surface)",
    colorInput: "var(--color-bg)",
    colorInputForeground: "var(--color-ink)",
    colorNeutral: "var(--color-ink)",
    colorBorder: "var(--color-line)",
    colorDanger: "var(--color-danger)",
    colorSuccess: "var(--color-success)",
    colorWarning: "var(--color-warning)",
    colorRing: "var(--color-focus)",
    colorModalBackdrop: "var(--color-scrim)",
    // Square everywhere (DESIGN.md "Space and layout"). A length with its unit, as Clerk computes from it.
    borderRadius: "0rem",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    // The card reads like the record: the 2px rule on top, hairline sides, no shadow.
    // The border sits on the outer box, which holds the card and its footer.
    cardBox: {
      boxShadow: "none",
      borderRadius: "0",
      border: "1px solid var(--color-line)",
      borderTop: "2px solid var(--color-rule)",
    },
    card: {
      boxShadow: "none",
      borderRadius: "0",
      border: "none",
      background: "var(--color-bg)",
    },
    // Clerk paints the card footer with its own grey; ours is the raised ground.
    footer: {
      background: "var(--color-surface)",
      borderRadius: "0",
    },
    // The board: a large title at the start, no "continue to <app>" line.
    header: {
      alignItems: "flex-start",
    },
    headerTitle: {
      fontWeight: 500,
      fontSize: "1.75rem",
      lineHeight: 1.25,
      textAlign: "start",
    },
    headerSubtitle: {
      display: "none",
    },
    // Email and password are Latin text inside an RTL page. This sets each
    // input's direction from its content, so a long email doesn't lose its start.
    formFieldInput: {
      unicodeBidi: "plaintext",
      textAlign: "start",
      // Clerk draws its input border as a faint shadow from state rules
      // ([data-feedback], [data-variant]) that outrank this one. Ours is a
      // real hairline, so it needs !important; the error state keeps danger.
      border: "1px solid var(--color-line-strong) !important",
      boxShadow: "none !important",
      '&[aria-invalid="true"]': { borderColor: "var(--color-danger) !important" },
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
      border: "1px solid var(--color-line-strong)",
      "&:focus": focusRing,
    },
    // One key per state. Clerk reads a space inside a nested selector as a
    // descendant combinator and logs its "Structural CSS" warning, so the
    // comma list "&:hover, &:focus, &:active" trips it. A single state doesn't.
    formButtonPrimary: {
      // Clerk lays a gradient over the button, in `background-image` and an
      // `::after` sheen. Both go, so the accent reads flat as on the board.
      backgroundColor: "var(--color-accent)",
      backgroundImage: "none",
      color: "var(--color-on-accent)",
      boxShadow: "none",
      "&::after": { display: "none" },
      "&:hover": primaryButtonActive,
      "&:active": primaryButtonActive,
      "&:focus": focusRing,
    },
  },
};
