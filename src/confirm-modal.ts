import { App, Modal, Setting, TFile } from "obsidian";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  /** Style the confirm button as destructive rather than as the default action. */
  destructive?: boolean;
}

export function confirmUnlink(app: App, note: TFile): Promise<boolean> {
  return confirm(app, {
    title: "Unlink note",
    message: `Remove the link between "${note.basename}" and this item? The note itself is kept.`,
    confirmText: "Unlink",
  });
}

export function confirmDelete(app: App, note: TFile): Promise<boolean> {
  return confirm(app, {
    title: "Delete note",
    message: `Move "${note.basename}" to the trash and remove its link?`,
    confirmText: "Delete",
    destructive: true,
  });
}

/** Resolves true if the user confirms, false if they cancel or dismiss. */
function confirm(app: App, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => new ConfirmModal(app, options, resolve).open());
}

class ConfirmModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private options: ConfirmOptions,
    private resolve: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.options.title });
    contentEl.createEl("p", { text: this.options.message });

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((btn) => {
        btn.setButtonText(this.options.confirmText).onClick(() => this.accept());
        if (this.options.destructive) btn.setWarning();
        else btn.setCta();
      });

    this.scope.register([], "Enter", (e) => {
      e.preventDefault();
      this.accept();
    });
  }

  private accept(): void {
    this.confirmed = true;
    this.close();
  }

  onClose(): void {
    this.resolve(this.confirmed);
  }
}
