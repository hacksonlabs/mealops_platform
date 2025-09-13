import React from "react";
import clsx from "clsx";
import Icon from "../../../components/AppIcon";

const META = {
  grubhub:{label:"Grubhub",icon:"Grubhub"},
  ubereats:{label:"Uber Eats",icon:"Uber"},
  doordash:{label:"DoorDash",icon:"DoorDash"},
};

export default function ProviderToggle({ providers=[], selected, onChange }) {
  if (!providers.length) return null;

  if (providers.length === 1) {
    const p = providers[0]; const m = META[p] || {label:p,icon:"CreditCard"};
    return (
      <div className="px-4 md:px-6 mt-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
          <Icon name={m.icon} size={16} /><span>{m.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 mt-4">
      <div className="inline-flex rounded-xl bg-muted p-1 border border-border">
        {providers.map(p=>{
          const m = META[p] || {label:p,icon:"CreditCard"};
          const active = p===selected;
          return (
            <button
              key={p}
              type="button"
              onClick={()=>onChange?.(p)}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition",
                active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon name={m.icon} size={16} /><span>{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  );
}
