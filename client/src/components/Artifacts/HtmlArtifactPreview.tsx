import { memo } from 'react';

export const HtmlArtifactPreview = memo(function HtmlArtifactPreview({
  html,
  refreshKey,
}: {
  html: string;
  refreshKey: number;
}) {
  if (!html.trim()) {
    return null;
  }

  return (
    <iframe
      key={refreshKey}
      title="HTML Artifact Preview"
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={html}
    />
  );
});
