import { UIResourceRenderer as LegacyUIResourceRenderer } from '@mcp-ui/client';
import type { UIResource } from 'librechat-data-provider';
import type { ComponentProps } from 'react';

type LegacyRendererProps = ComponentProps<typeof LegacyUIResourceRenderer>;

type UIResourceRendererProps = Omit<
  LegacyRendererProps,
  'resource' | 'remoteDomProps' | 'supportedContentTypes'
> & {
  resource: UIResource;
};

export function isSupportedUIResource(
  resource: UIResource | null | undefined,
): resource is UIResource {
  return (
    typeof resource?.mimeType === 'string' &&
    resource.mimeType.split(';', 1)[0].trim().toLowerCase() === 'text/html'
  );
}

/** Restricts legacy MCP-UI rendering to sandboxed inline HTML resources. */
export default function UIResourceRenderer({
  resource,
  htmlProps,
  ...props
}: UIResourceRendererProps) {
  if (!isSupportedUIResource(resource)) {
    return null;
  }

  const safeResource = { ...resource };
  const safeHtmlProps = { ...htmlProps };
  delete safeResource.contentType;
  safeResource.mimeType = 'text/html';
  delete safeHtmlProps.sandboxPermissions;
  if (safeResource.uri === 'ui://drawio/mcp-app.html') {
    safeHtmlProps.sandboxPermissions = 'allow-popups allow-downloads';
  }

  return (
    <LegacyUIResourceRenderer
      {...props}
      resource={safeResource}
      htmlProps={safeHtmlProps}
      supportedContentTypes={['rawHtml']}
    />
  );
}
