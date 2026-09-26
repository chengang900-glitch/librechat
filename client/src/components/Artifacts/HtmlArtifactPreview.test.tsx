import { render } from '@testing-library/react';
import { HtmlArtifactPreview } from './HtmlArtifactPreview';

describe('HtmlArtifactPreview', () => {
  it('renders HTML in an HTTP-compatible restricted iframe', () => {
    const html = '<script>document.body.dataset.ready = "yes"</script>';
    const { getByTitle } = render(<HtmlArtifactPreview html={html} refreshKey={2} />);
    const iframe = getByTitle('HTML Artifact Preview');

    expect(iframe).toHaveAttribute('srcdoc', html);
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    expect(iframe).toHaveClass('h-full', 'w-full');
  });

  it('does not mount an iframe for blank HTML', () => {
    const { queryByTitle } = render(<HtmlArtifactPreview html="  " refreshKey={0} />);
    expect(queryByTitle('HTML Artifact Preview')).toBeNull();
  });
});
