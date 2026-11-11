import { Fragment, type ReactNode } from "react";

/**
 * Turns the line breaks of a text into `<br />`, so they hold in every mail
 * app and in the plain-text copy of the email (CSS `white-space` does
 * neither). Each line stays text: nothing is read as markup.
 */
export function withLineBreaks(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return children.split(/\r\n|\r|\n/).map((line, index) => (
      <Fragment key={index}>
        {index > 0 ? <br /> : null}
        {line}
      </Fragment>
    ));
  }
  if (Array.isArray(children)) {
    return children.map((child: ReactNode, index) => (
      <Fragment key={index}>{withLineBreaks(child)}</Fragment>
    ));
  }
  return children;
}
