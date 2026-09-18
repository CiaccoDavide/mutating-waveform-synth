import { useId, useState, type ReactNode } from 'react';
import { useIsMobile } from './useMediaQuery';

export type CollapseMode = 'always' | 'mobile';

interface CollapsibleSectionProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** always = collapsible everywhere; mobile = only when viewport ≤ 720px */
  mode?: CollapseMode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
}

export function CollapsibleSection({
  title,
  actions,
  children,
  mode = 'always',
  defaultOpen = true,
  className = '',
  headerClassName = 'panel-header',
  titleClassName = 'panel-title',
}: CollapsibleSectionProps) {
  const isMobile = useIsMobile();
  const collapsible = mode === 'always' || isMobile;
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const showBody = !collapsible || open;

  return (
    <div
      className={`collapsible ${className}${collapsible ? ' is-collapsible' : ''}${showBody ? ' is-open' : ' is-closed'}`.trim()}
    >
      <div className={headerClassName}>
        {collapsible ? (
          <button
            type="button"
            className="collapse-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`collapse-chevron${open ? ' is-open' : ''}`} aria-hidden>
              ▸
            </span>
            <span className={titleClassName}>{title}</span>
          </button>
        ) : (
          <span className={titleClassName}>{title}</span>
        )}
        {actions ? (
          <div className="panel-header-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </div>
      {showBody ? (
        <div id={panelId} className="collapsible-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
