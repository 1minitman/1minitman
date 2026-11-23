import { createFileRoute } from '@tanstack/react-router';
import { findNavItem } from '../shell/navigation';

// Every module route that is not built yet lands here (admin spec M1: "empty module placeholders").
// Building a module = adding its own route file, which then takes precedence over this one.
export const Route = createFileRoute('/$')({ component: ModulePlaceholder });

function ModulePlaceholder() {
  const { _splat } = Route.useParams();
  const item = findNavItem(`/${_splat ?? ''}`);

  if (!item) {
    return (
      <div className="max-w-xl">
        <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.03em]">
          Page not found
        </h1>
        <p className="mt-2 text-fg-2">Nothing lives at this address.</p>
      </div>
    );
  }
  return (
    <div className="max-w-xl">
      <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.03em]">{item.label}</h1>
      <p className="mt-2 text-fg-2">
        Module {item.module} is not built yet. It is planned for milestone {item.milestone}.
      </p>
      <dl className="mt-6 grid grid-cols-[10rem_1fr] gap-y-2 rounded-sm border p-4 text-[14px]">
        <dt className="text-fg-2">Spec</dt>
        <dd>ADMIN_UI_MODULES_FLOWS · {item.module}</dd>
        <dt className="text-fg-2">View permission</dt>
        <dd className="font-mono">{item.permission}</dd>
      </dl>
    </div>
  );
}
