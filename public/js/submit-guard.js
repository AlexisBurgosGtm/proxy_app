/** Evita doble envío bloqueando botones hasta que termine la operación async. */
const busy = new WeakSet();

export function isSubmitGuarded(source) {
  return busy.has(source);
}

export function getFormSubmitButtons(form) {
  const buttons = [];
  if (form.id) {
    document
      .querySelectorAll(`button[type="submit"][form="${CSS.escape(form.id)}"]`)
      .forEach((btn) => buttons.push(btn));
  }
  form.querySelectorAll('button[type="submit"]').forEach((btn) => {
    if (!buttons.includes(btn)) buttons.push(btn);
  });
  return buttons;
}

function resolveButtons(source) {
  if (source instanceof HTMLFormElement) {
    return getFormSubmitButtons(source);
  }
  if (source instanceof HTMLButtonElement) {
    const form = source.form;
    if (form) return getFormSubmitButtons(form);
    return [source];
  }
  return [];
}

function setButtonsLocked(buttons, locked) {
  for (const btn of buttons) {
    if (!btn) continue;
    btn.disabled = locked;
    if (locked) {
      btn.setAttribute('aria-busy', 'true');
    } else {
      btn.removeAttribute('aria-busy');
    }
  }
}

/**
 * Ejecuta una operación async bloqueando los botones de envío del formulario o botón.
 * @param {HTMLFormElement|HTMLButtonElement} source
 * @param {() => Promise<void>|void} fn
 */
export async function withSubmitGuard(source, fn) {
  if (!source || busy.has(source)) return;
  busy.add(source);
  const buttons = resolveButtons(source);
  setButtonsLocked(buttons, true);
  try {
    return await fn();
  } finally {
    setButtonsLocked(buttons, false);
    busy.delete(source);
  }
}

/**
 * Registra submit con preventDefault y bloqueo hasta completar el handler.
 * @param {HTMLFormElement} form
 * @param {(e: SubmitEvent) => Promise<void>|void} handler
 */
export function bindGuardedSubmit(form, handler) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy.has(form)) return;
    void withSubmitGuard(form, () => handler(e));
  });
}

/**
 * Registra click con bloqueo (eliminar, acciones que guardan/borran).
 * @param {HTMLButtonElement} element
 * @param {(e: MouseEvent) => Promise<void>|void} handler
 */
export function bindGuardedClick(element, handler) {
  element.addEventListener('click', (e) => {
    if (busy.has(element)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    void withSubmitGuard(element, () => handler(e));
  });
}
