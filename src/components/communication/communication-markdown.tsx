"use client";

import dynamic from "next/dynamic";
import { memo, type ComponentPropsWithoutRef } from "react";

const Markdown = dynamic(() => import("react-markdown"), { ssr: false });

const ALLOWED_ELEMENTS = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

type MarkdownHeadingProps = ComponentPropsWithoutRef<"h2"> & {
  node?: unknown;
};

function CompactHeading({ node, children }: MarkdownHeadingProps) {
  void node;
  return <p className="communication-markdown-heading">{children}</p>;
}

function CommunicationMarkdownComponent({ body }: { body: string }) {
  return (
    <div className="communication-markdown">
      <Markdown
        allowedElements={ALLOWED_ELEMENTS}
        components={{
          h1: CompactHeading,
          h2: CompactHeading,
          h3: CompactHeading,
          h4: CompactHeading,
          h5: CompactHeading,
          h6: CompactHeading,
        }}
        skipHtml
        unwrapDisallowed
      >
        {body}
      </Markdown>
    </div>
  );
}

export const CommunicationMarkdown = memo(CommunicationMarkdownComponent);
