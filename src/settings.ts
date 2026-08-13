// src/settings.ts
import * as obsidian from "obsidian";
import { CORE_QUESTIONS, DEFAULT_SETTINGS, configuredAdaptiveQuestionLimit, configuredCoreQuestions } from "./defaults";
import { errorMessage, showMindTraceFieldError } from "./journal-view";
import { attachLlmActivityStatus, captureMindTraceContext, isChatCompletionsProvider, openMindTraceOperation, restoreMindTraceContext } from "./providers";
import { mindTraceWindow, showMindTraceNotice } from "./runtime-preamble";
import { normalizeReportFolderValue, observationFolder, resolveReportFolder } from "./weekly-report";

export { MindTraceSettingTab, PROVIDER_LABELS };
var PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  kimi: "Kimi",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  "openai-compatible": "OpenAI-compatible"
};
var PROVIDER_MODEL_PRESETS = {
  kimi: [
    { value: "kimi-k3", label: "Kimi K3" },
    { value: "kimi-k2.6", label: "Kimi K2.6" }
  ],
  deepseek: [
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" }
  ],
  qwen: [
    { value: "qwen3.8-max", label: "Qwen 3.8 Max" },
    { value: "qwen3.7-plus", label: "Qwen 3.7 Plus" },
    { value: "qwen3.7-flash", label: "Qwen 3.7 Flash" }
  ]
};
var CUSTOM_MODEL_OPTION = "__mind_trace_custom_model__";
var THINKING_LABELS = {
  auto: "自动（服务商默认）",
  off: "关闭深度思考",
  on: "开启深度思考"
};
var TONE_LABELS = {
  gentle: "温和但具体",
  direct: "直接教练式",
  companion: "纯陪伴式"
};
var PrivacyPasswordModal = class extends obsidian.Modal {
  declare plugin: any;
  declare onDone: () => void;
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone;
  }
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("mind-trace-password-modal-shell", "mind-trace-dialog-shell");
    contentEl.empty();
    contentEl.addClass("mind-trace-password-modal");
    const configured = this.plugin.isPasswordConfigured();
    const eyebrow = contentEl.createDiv({ cls: "mind-trace-dialog-eyebrow", text: "心迹 · 隐私" });
    eyebrow.setAttribute("aria-hidden", "true");
    contentEl.createDiv({ cls: "mind-trace-dialog-title", text: configured ? "管理心迹密码" : "设置心迹密码" });
    contentEl.createEl("p", {
      cls: "mind-trace-dialog-body",
      text: "密码只保护心迹插件界面，不会加密 vault 中的 Markdown 原文。"
    });
    const form = contentEl.createEl("form", { cls: "mind-trace-password-form" });
    let current = null;
    if (configured && !this.plugin.isPrivacyUnlocked()) {
      current = form.createEl("input", {
        attr: {
          type: "password",
          placeholder: "当前密码",
          autocomplete: "current-password",
          "aria-label": "当前心迹密码"
        }
      });
    }
    const next = form.createEl("input", {
      attr: {
        type: "password",
        placeholder: configured ? "新密码（至少 8 个字符）" : "密码（至少 8 个字符）",
        autocomplete: "new-password",
        "aria-label": configured ? "新心迹密码" : "心迹密码"
      }
    });
    const confirmation = form.createEl("input", {
      attr: {
        type: "password",
        placeholder: "再次输入新密码",
        autocomplete: "new-password",
        "aria-label": "确认新心迹密码"
      }
    });
    const error = form.createEl("p", {
      cls: "mind-trace-lock-error",
      attr: { role: "alert", "aria-live": "polite" }
    });
    const actions = form.createDiv({ cls: "mind-trace-actions mind-trace-dialog-actions" });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    let save = null;
    if (configured) {
      const remove = actions.createEl("button", {
        cls: "mod-warning",
        text: "移除密码",
        attr: { type: "button" }
      });
      remove.addEventListener("click", () => {
        if (current !== null && current.value.length === 0) {
          error.textContent = "请输入当前密码";
          current.focus();
          return;
        }
        const currentPassword = current?.value ?? "";
        openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 隐私",
          title: "移除心迹密码？",
          description: "移除后，心迹页面会要求重新设置密码才能进入；Vault 中的 Markdown 原文不会改变。",
          confirmLabel: "移除密码",
          warning: true,
          stages: ["验证并移除密码"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "验证并移除密码", detail: "正在更新本地隐私设置。" });
            await this.plugin.removePrivacyPassword(currentPassword);
          },
          onSuccess: () => {
            showMindTraceNotice("心迹密码已移除");
            this.close();
            this.onDone();
          },
          successTitle: "心迹密码已移除",
          successDetail: "下次进入心迹页面时需要重新设置密码。",
          successLabel: "返回设置"
        });
      });
    }
    save = actions.createEl("button", {
      cls: "mod-cta",
      text: configured ? "更新密码" : "设置密码",
      attr: { type: "submit" }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      error.textContent = "";
      if (next.value.length < 8) {
        error.textContent = "密码至少需要 8 个字符";
        next.focus();
        return;
      }
      if (next.value !== confirmation.value) {
        error.textContent = "两次输入的新密码不一致";
        confirmation.focus();
        return;
      }
      save.disabled = true;
      void (configured ? this.plugin.changePrivacyPassword(current?.value ?? "", next.value) : this.plugin.configurePrivacyPassword(next.value)).then(() => {
        showMindTraceNotice(configured ? "心迹密码已更新" : "心迹密码已设置");
        this.close();
        this.onDone();
      }).catch((reason) => {
        error.textContent = reason instanceof Error ? reason.message : "无法保存密码";
        save.disabled = false;
      });
    });
    mindTraceWindow(this.contentEl).requestAnimationFrame(() => (current ?? next).focus());
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MindTraceSettingTab = class extends obsidian.PluginSettingTab {
  declare plugin: any;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  connectionTestBusy = false;
  display(preserveContext = false) {
    const { containerEl } = this;
    const context = preserveContext ? captureMindTraceContext(containerEl) : null;
    containerEl.empty();
    containerEl.addClass("mind-trace-settings");
    const providerSection = this.createSection(
      "模型与连接",
      "用于个性化追问、整理日记和生成反思。"
    );
    const providerCard = providerSection.createDiv({ cls: "mind-trace-provider-card" });
    this.renderProviderCard(providerCard);
    this.renderDialogueSettings();
    const journalSection = this.createSection(
      "日记与反思",
      "决定日记保存在哪里，以及心迹如何回应你。"
    );
    const reportFolderDescriptionUpdates = [];
    let journalFolderText;
    let committedJournalFolder = normalizeReportFolderValue(this.plugin.settings.journalFolder);
    let journalFolderMigrationQueue = Promise.resolve();
    const commitJournalFolder = (rawValue) => {
      const nextFolder = normalizeReportFolderValue(rawValue);
      journalFolderMigrationQueue = journalFolderMigrationQueue.then(async () => {
        if (nextFolder === committedJournalFolder) {
          journalFolderText?.setValue(committedJournalFolder);
          return;
        }
        if (nextFolder.length === 0) {
          journalFolderText?.setValue(committedJournalFolder);
          showMindTraceNotice("日记目录不能为空");
          return;
        }
        let folderMoved = false;
        try {
          const movedFileCount = await this.moveJournalFolderContents(committedJournalFolder, nextFolder);
          folderMoved = true;
          this.plugin.settings.journalFolder = nextFolder;
          await this.plugin.saveSettings();
          committedJournalFolder = nextFolder;
          journalFolderText?.setValue(nextFolder);
          for (const updateDescription of reportFolderDescriptionUpdates) {
            updateDescription();
          }
          this.plugin.refreshJournalViews();
          this.plugin.refreshWeeklyEventViews();
          showMindTraceNotice(
            movedFileCount > 0
              ? `日记目录已更新，已迁移 ${movedFileCount} 个文件`
              : "日记目录已更新"
          );
        } catch (error) {
          if (folderMoved) {
            committedJournalFolder = nextFolder;
            this.plugin.settings.journalFolder = nextFolder;
            journalFolderText?.setValue(nextFolder);
            showMindTraceNotice(`文件已移动，但日记目录设置保存失败：${errorMessage(error)}`, 8e3);
            return;
          }
          journalFolderText?.setValue(committedJournalFolder);
          showMindTraceNotice(`日记目录未修改：${errorMessage(error)}`, 8e3);
        }
      });
      void journalFolderMigrationQueue;
    };
    new obsidian.Setting(journalSection).setName("日记目录").setDesc("心迹日记在当前 vault 中的保存目录；修改后会同时迁移原目录中的文件").addText(
      (text) => {
        journalFolderText = text;
        text.setPlaceholder("Mind trace").setValue(committedJournalFolder);
        text.inputEl.addEventListener("blur", () => commitJournalFolder(text.getValue()));
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            text.inputEl.blur();
          }
        });
      }
    );
    const historySetting = new obsidian.Setting(journalSection).setName("参考近期日记").setDesc(
      `用于按需追问和日记反思；当前参考最近 ${this.plugin.settings.historyDays} 天，0 表示关闭`
    );
    let historyText;
    let historySlider;
    const applyHistoryDays = async (raw, source) => {
      if (!Number.isFinite(raw)) {
        return;
      }
      const value = Math.max(0, Math.min(30, Math.round(raw)));
      this.plugin.settings.historyDays = value;
      historySetting.setDesc(
        `用于按需追问和日记反思；当前参考最近 ${value} 天，0 表示关闭`
      );
      if (source !== "text") {
        historyText?.setValue(String(value));
      } else if (historyText?.getValue() !== String(value)) {
        historyText?.setValue(String(value));
      }
      if (source !== "slider") {
        historySlider?.setValue(value);
      }
      await this.plugin.saveSettings();
    };
    historySetting.addText((text) => {
      historyText = text;
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "30";
      text.inputEl.step = "1";
      text.inputEl.addClass("mind-trace-number-input");
      text.setValue(String(this.plugin.settings.historyDays)).onChange(async (value) => {
        if (value.trim().length > 0) {
          await applyHistoryDays(Number(value), "text");
        }
      });
      text.inputEl.addEventListener("blur", () => {
        text.setValue(String(this.plugin.settings.historyDays));
      });
    });
    historySetting.addSlider(
      (slider) => {
        historySlider = slider;
        slider.setLimits(0, 30, 1).setValue(this.plugin.settings.historyDays).setDynamicTooltip().onChange(async (value) => {
          await applyHistoryDays(value, "slider");
        });
      }
    );
    new obsidian.Setting(journalSection).setName("反思语气").setDesc("控制洞察和建议的默认表达方式").addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(TONE_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(this.plugin.settings.reflectionTone).onChange(async (value) => {
        this.plugin.settings.reflectionTone = value;
        await this.plugin.saveSettings();
      });
    });
    new obsidian.Setting(journalSection).setName("个人化说明").setDesc("例如：少用鼓励套话、关注工作边界、不要替我下结论").addTextArea(
      (text) => text.setPlaceholder("可选").setValue(this.plugin.settings.customInstructions).onChange(async (value) => {
        this.plugin.settings.customInstructions = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const analysisSection = this.createSection(
      "回顾与分析",
      "按自然周与自然月生成结构化回顾；只有进入已解锁的心迹主页或回顾页时才会请求模型。"
    );
    new obsidian.Setting(analysisSection).setName("自动补齐上周周报").setDesc(
      "每个应用会话对最近一个完整周最多自动尝试一次；生成前会联合校准未人工确认的事件并写回日记。"
    ).addToggle((toggle) => toggle.setValue(this.plugin.settings.weeklyReportAutoGenerate !== false).onChange(async (value) => {
      this.plugin.settings.weeklyReportAutoGenerate = value;
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    const minimumDays = Math.min(7, Math.max(4, Number(this.plugin.settings.weeklyReportMinimumDays) || 5));
    this.plugin.settings.weeklyReportMinimumDays = minimumDays;
    const minimumSetting = new obsidian.Setting(analysisSection).setName("周报最低记录日").setDesc(
      `当前为 ${minimumDays} 天；低于门槛时不调用模型`
    );
    minimumSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-minimum-days");
      return slider.setLimits(4, 7, 1).setValue(minimumDays).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyReportMinimumDays = value;
      minimumSetting.setDesc(`当前为 ${value} 天；低于门槛时不调用模型`);
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
      });
    });
    const weeklyEventLimit = Math.min(100, Math.max(10, Math.round((Number(this.plugin.settings.weeklyEventLimit) || 50) / 5) * 5));
    this.plugin.settings.weeklyEventLimit = weeklyEventLimit;
    const eventLimitSetting = new obsidian.Setting(analysisSection).setName("每周事件上限").setDesc(
      `当前最多保留 ${weeklyEventLimit} 件事件；人工确认内容不会因降低上限而删除`
    );
    eventLimitSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-event-limit");
      return slider.setLimits(10, 100, 5).setValue(weeklyEventLimit).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyEventLimit = value;
      if (this.plugin.settings.weeklyGraphEventLimit > value) {
        this.plugin.settings.weeklyGraphEventLimit = Math.max(5, Math.min(50, value));
      }
      eventLimitSetting.setDesc(`当前最多保留 ${value} 件事件；人工确认内容不会因降低上限而删除`);
      await this.plugin.saveSettings();
      this.display(true);
      this.plugin.refreshJournalViews();
      this.plugin.refreshWeeklyEventViews();
      });
    });
    const weeklyGraphEventLimit = Math.min(50, Math.max(5, Math.min(weeklyEventLimit, Math.round(Number(this.plugin.settings.weeklyGraphEventLimit) || 20))));
    this.plugin.settings.weeklyGraphEventLimit = weeklyGraphEventLimit;
    const graphLimitSetting = new obsidian.Setting(analysisSection).setName("星图显示事件数").setDesc(
      `当前同时显示 ${weeklyGraphEventLimit} 件；完整内容始终保留在事件账中`
    );
    graphLimitSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "weekly-graph-event-limit");
      return slider.setLimits(5, Math.min(50, weeklyEventLimit), 1).setValue(weeklyGraphEventLimit).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.weeklyGraphEventLimit = value;
      graphLimitSetting.setDesc(`当前同时显示 ${value} 件；完整内容始终保留在事件账中`);
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
      this.plugin.refreshWeeklyEventViews();
      });
    });
    const addReportFolderSetting = (type, name, settingKey) => {
      const setting = new obsidian.Setting(analysisSection).setName(name);
      let text;
      let followButton;
      const updateDescription = () => {
        const configured = normalizeReportFolderValue(this.plugin.settings[settingKey]);
        let resolved;
        try {
          resolved = type === "observation" ? observationFolder(this.plugin.settings) : resolveReportFolder(this.plugin.settings, type);
        } catch {
          resolved = "无法解析（请先设置有效的日记目录）";
        }
        setting.setDesc(
          `留空即可跟随日记目录；当前实际路径：${resolved}${configured.length === 0 ? "（跟随日记目录）" : ""}`
        );
        followButton?.setDisabled(configured.length === 0);
      };
      reportFolderDescriptionUpdates.push(updateDescription);
      setting.addText((control) => {
        text = control;
        const current = normalizeReportFolderValue(this.plugin.settings[settingKey]);
        this.plugin.settings[settingKey] = current;
        control.setPlaceholder("留空以跟随日记目录").setValue(current).onChange(async (value) => {
          const normalized = normalizeReportFolderValue(value);
          this.plugin.settings[settingKey] = normalized;
          if (control.getValue() !== normalized) {
            control.setValue(normalized);
          }
          updateDescription();
          await this.plugin.saveSettings();
          this.plugin.refreshJournalViews();
        });
        control.inputEl.addEventListener("blur", () => {
          control.setValue(normalizeReportFolderValue(this.plugin.settings[settingKey]));
        });
      });
      setting.addButton((button) => {
        followButton = button;
        return button.setButtonText("跟随日记目录").onClick(async () => {
          this.plugin.settings[settingKey] = "";
          text?.setValue("");
          updateDescription();
          await this.plugin.saveSettings();
          this.plugin.refreshJournalViews();
        });
      });
      updateDescription();
    };
    addReportFolderSetting("weekly", "周报保存位置", "weeklyReportFolder");
    new obsidian.Setting(analysisSection).setName("自动补齐上月月报").setDesc(
      "每个应用会话对最近一个完整月最多自动尝试一次；只创建缺失月报，不覆盖预览、过期或手工编辑文件。"
    ).addToggle((toggle) => toggle.setValue(this.plugin.settings.monthlyReportAutoGenerate !== false).onChange(async (value) => {
      this.plugin.settings.monthlyReportAutoGenerate = value;
      await this.plugin.saveSettings();
      this.plugin.refreshJournalViews();
    }));
    const minimumWeeks = Math.min(5, Math.max(1, Number(this.plugin.settings.monthlyReportMinimumWeeks) || 4));
    this.plugin.settings.monthlyReportMinimumWeeks = minimumWeeks;
    const minimumMonthSetting = new obsidian.Setting(analysisSection).setName("月报最低周报数").setDesc(
      `当前为 ${minimumWeeks} 份；完整自然月达到该数量的已生成周报后，才会生成正式月报`
    );
    minimumMonthSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "monthly-minimum-weeks");
      return slider.setLimits(1, 5, 1).setValue(minimumWeeks).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.monthlyReportMinimumWeeks = value;
        minimumMonthSetting.setDesc(`当前为 ${value} 份；完整自然月达到该数量的已生成周报后，才会生成正式月报`);
        await this.plugin.saveSettings();
        this.plugin.refreshJournalViews();
      });
    });
    const monthlyGraphEventLimit = Math.min(200, Math.max(50, Math.round((Number(this.plugin.settings.monthlyGraphEventLimit) || 100) / 10) * 10));
    this.plugin.settings.monthlyGraphEventLimit = monthlyGraphEventLimit;
    const monthlyGraphSetting = new obsidian.Setting(analysisSection).setName("月图谱显示事件数").setDesc(
      `当前月报星图显示 ${monthlyGraphEventLimit} 件；折叠事件账保留全部事件`
    );
    monthlyGraphSetting.addSlider((slider) => {
      slider.sliderEl.setAttribute("data-mind-trace-focus-key", "monthly-graph-event-limit");
      return slider.setLimits(50, 200, 10).setValue(monthlyGraphEventLimit).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.monthlyGraphEventLimit = value;
        monthlyGraphSetting.setDesc(`当前月报星图显示 ${value} 件；折叠事件账保留全部事件`);
        await this.plugin.saveSettings();
        this.plugin.refreshJournalViews();
        this.plugin.refreshWeeklyEventViews();
      });
    });
    addReportFolderSetting("monthly", "月报保存位置", "monthlyReportFolder");
    addReportFolderSetting("observation", "观照保存位置", "observationFolder");
    const privacySection = this.createSection(
      "隐私与草稿",
      "心迹密码可选：设置后保护插件界面，不会加密 Vault 中的 Markdown 原文；未完成问答保存在插件 data.json 中。"
    );
    new obsidian.Setting(privacySection).setName("心迹密码").setDesc(
      this.plugin.isPasswordConfigured() ? this.plugin.isPrivacyUnlocked() ? "已设置 · 当前已解锁，两小时后自动锁定" : "已设置 · 当前已锁定" : "可选：未设置时可直接进入，首次进入时也可以选择暂不设置"
    ).addButton(
      (button) => button.setButtonText(this.plugin.isPasswordConfigured() ? "管理密码" : "设置密码").onClick(() => {
        new PrivacyPasswordModal(this.app, this.plugin, () => this.display(true)).open();
      })
    ).addButton(
      (button) => button.setButtonText("立即锁定").setDisabled(!this.plugin.isPasswordConfigured() || !this.plugin.isPrivacyGateEnabled() || !this.plugin.isPrivacyUnlocked()).onClick(() => {
        this.plugin.lockPrivacy(true);
        this.display(true);
      })
    );
    new obsidian.Setting(privacySection).setName("清除未完成草稿").setDesc(
      this.plugin.draft === null ? "当前没有未完成草稿" : "清除评分、问答和尚未保存的生成结果"
    ).addButton(
      (button) => button.setButtonText("清除").setWarning().setDisabled(this.plugin.draft === null).onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 草稿",
          title: "清除未完成草稿？",
          description: "评分、问答和尚未保存的生成结果都会被清除，此操作无法撤销。",
          confirmLabel: "清除草稿",
          warning: true,
          stages: ["清除未完成内容"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "清除未完成内容", detail: "正在更新本地草稿状态。" });
            await this.plugin.setDraft(null);
          },
          onSuccess: () => this.display(true),
          successTitle: "草稿已清除",
          successDetail: "未完成的评分、问答和校样已经清除。",
          successLabel: "返回设置",
          backgroundSuccess: "心迹草稿已清除"
        });
      })
    );
    if (context !== null) {
      restoreMindTraceContext(containerEl, context);
    }
  }
  renderDialogueSettings() {
    const section = this.createSection(
      "对话结构",
      "安排心迹先问什么、最多再追问多少。核心问题和数量上限用于下一篇新日记，按需追问会在信息足够时提前结束。"
    );
    const coreQuestions = configuredCoreQuestions(this.plugin.settings);
    const adaptiveQuestionLimit = configuredAdaptiveQuestionLimit(
      this.plugin.settings
    );
    new obsidian.Setting(section).setName("个性化问题最大数量").setDesc("这是追问上限，不要求问满；AI 会根据信息是否充足提前停止。0 表示不追问，最多可设 5 个").addText(
      (text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "5";
        text.inputEl.step = "1";
        text.inputEl.addClass("mind-trace-number-input");
        text.setValue(String(adaptiveQuestionLimit)).onChange(async (raw) => {
          if (raw.trim().length === 0 || !Number.isFinite(Number(raw))) {
            return;
          }
          const value = Math.max(0, Math.min(5, Math.round(Number(raw))));
          if (raw !== String(value)) {
            text.setValue(String(value));
          }
          this.plugin.settings.adaptiveQuestionLimit = value;
          await this.plugin.saveSettings();
        });
        text.inputEl.addEventListener("blur", () => {
          text.setValue(String(configuredAdaptiveQuestionLimit(this.plugin.settings)));
        });
      }
    );
    const editor = section.createDiv({
      cls: "mind-trace-question-config"
    });
    const toolbar = editor.createDiv({
      cls: "mind-trace-question-config-toolbar"
    });
    const toolbarCopy = toolbar.createDiv();
    toolbarCopy.createDiv({
      cls: "mind-trace-question-config-title",
      text: "核心问题"
    });
    toolbarCopy.createEl("p", {
      text: `${coreQuestions.length} 个问题 \xB7 按顺序出现，可设置 1–8 个`
    });
    const addButton = toolbar.createEl("button", {
      cls: "mind-trace-question-config-add",
      attr: {
        type: "button",
        "aria-label": "添加核心问题"
      }
    });
    (0, obsidian.setIcon)(addButton, "plus");
    addButton.createSpan({ text: "添加" });
    addButton.disabled = coreQuestions.length >= 8;
    addButton.addEventListener("click", () => {
      const questions = configuredCoreQuestions(this.plugin.settings);
      if (questions.length >= 8) {
        return;
      }
      this.plugin.settings.coreQuestions = [
        ...questions,
        "今天还有什么值得记下？"
      ];
      void this.plugin.saveSettings().then(() => {
        this.display(true);
      });
    });
    const list = editor.createDiv({
      cls: "mind-trace-question-config-list"
    });
    for (const [index, question] of coreQuestions.entries()) {
      const row = list.createDiv({
        cls: "mind-trace-question-config-row"
      });
      row.createDiv({
        cls: "mind-trace-question-config-index",
        text: String(index + 1).padStart(2, "0"),
        attr: { "aria-hidden": "true" }
      });
      const input = row.createEl("textarea", {
        cls: "mind-trace-question-config-input",
        text: question,
        attr: {
          rows: "2",
          "aria-label": `核心问题 ${index + 1}`
        }
      });
      input.addEventListener("change", () => {
        const questions = configuredCoreQuestions(this.plugin.settings);
        const value = input.value.trim();
        if (value.length === 0) {
          input.value = questions[index] ?? question;
          showMindTraceFieldError(input, "核心问题不能为空");
          return;
        }
        if (index >= questions.length) {
          input.value = questions[index] ?? question;
          return;
        }
        questions[index] = value;
        this.plugin.settings.coreQuestions = questions;
        void this.plugin.saveSettings();
      });
      const actions = row.createDiv({
        cls: "mind-trace-question-config-actions"
      });
      this.createQuestionAction(
        actions,
        "arrow-up",
        `上移问题 ${index + 1}`,
        index === 0,
        () => {
          const questions = configuredCoreQuestions(this.plugin.settings);
          if (index <= 0 || index >= questions.length) {
            return;
          }
          const [currentQuestion] = questions.splice(index, 1);
          questions.splice(index - 1, 0, currentQuestion);
          this.plugin.settings.coreQuestions = questions;
          void this.plugin.saveSettings().then(() => {
            this.display(true);
          });
        }
      );
      this.createQuestionAction(
        actions,
        "arrow-down",
        `下移问题 ${index + 1}`,
        index === coreQuestions.length - 1,
        () => {
          const questions = configuredCoreQuestions(this.plugin.settings);
          if (index < 0 || index >= questions.length - 1) {
            return;
          }
          const [currentQuestion] = questions.splice(index, 1);
          questions.splice(index + 1, 0, currentQuestion);
          this.plugin.settings.coreQuestions = questions;
          void this.plugin.saveSettings().then(() => {
            this.display(true);
          });
        }
      );
      this.createQuestionAction(
        actions,
        "trash-2",
        `删除问题 ${index + 1}`,
        coreQuestions.length === 1,
        () => {
          const latestQuestions = configuredCoreQuestions(this.plugin.settings);
          const latestQuestion = latestQuestions[index] ?? question;
          return openMindTraceOperation(this.app, this.plugin, {
            eyebrow: "心迹设置 · 核心问题",
            title: `删除第 ${index + 1} 个核心问题？`,
            description: `“${latestQuestion}”将从下一篇新日记的问题列表中移除。`,
            confirmLabel: "删除问题",
            warning: true,
            stages: ["更新问题列表"],
            run: async (update) => {
              update({ stage: 1, total: 1, title: "更新问题列表", detail: "正在保存新的问题顺序。" });
              const questions = configuredCoreQuestions(this.plugin.settings);
              if (questions.length <= 1 || index < 0 || index >= questions.length) {
                return;
              }
              this.plugin.settings.coreQuestions = questions.filter((_, questionIndex) => questionIndex !== index);
              await this.plugin.saveSettings();
            },
            onSuccess: () => this.display(true),
            successTitle: "核心问题已删除",
            successDetail: "新的问题列表会从下一篇日记开始使用。",
            successLabel: "返回设置"
          });
        }
      );
    }
    new obsidian.Setting(section).setName("恢复推荐问题").setDesc("恢复心迹默认的三道问题，不影响进行中的草稿").addButton(
      (button) => button.setButtonText("恢复默认").onClick(() => {
        openMindTraceOperation(this.app, this.plugin, {
          eyebrow: "心迹设置 · 核心问题",
          title: "恢复推荐问题？",
          description: "当前自定义问题和排序会被推荐的三道问题替换，不影响进行中的草稿。",
          confirmLabel: "恢复推荐问题",
          warning: true,
          stages: ["恢复问题列表"],
          run: async (update) => {
            update({ stage: 1, total: 1, title: "恢复问题列表", detail: "正在保存推荐问题。" });
            this.plugin.settings.coreQuestions = [...CORE_QUESTIONS];
            await this.plugin.saveSettings();
          },
          onSuccess: () => this.display(true),
          successTitle: "推荐问题已恢复",
          successDetail: "新的问题列表会从下一篇日记开始使用。",
          successLabel: "返回设置"
        });
      })
    );
  }
  async moveJournalFolderContents(previousPath, nextPath) {
    if (previousPath === nextPath) {
      return 0;
    }
    if (previousPath.length > 0 && nextPath.startsWith(`${previousPath}/`)) {
      throw new Error("新日记目录不能位于旧目录内");
    }
    const source = this.app.vault.getAbstractFileByPath(previousPath);
    const destination = this.app.vault.getAbstractFileByPath(nextPath);
    if (destination !== null && !(destination instanceof obsidian.TFolder)) {
      throw new Error(`无法迁移日记目录：${nextPath} 已经是文件`);
    }
    if (source === null) {
      return 0;
    }
    if (!(source instanceof obsidian.TFolder)) {
      throw new Error(`无法迁移日记目录：${previousPath} 已经是文件`);
    }

    const files = [];
    const sourceFolders = [];
    const collect = (folder) => {
      sourceFolders.push(folder);
      for (const child of [...folder.children]) {
        if (child instanceof obsidian.TFolder) {
          collect(child);
        } else if (child instanceof obsidian.TFile) {
          files.push(child);
        }
      }
    };
    collect(source);

    if (destination === null) {
      await this.app.fileManager.renameFile(source, nextPath);
      return files.length;
    }
    if (files.length === 0) {
      return 0;
    }

    const sourcePrefix = `${previousPath}/`;
    const entries = files.map((file) => {
      const oldPath = file.path;
      const relativePath = oldPath.startsWith(sourcePrefix) ? oldPath.slice(sourcePrefix.length) : file.name;
      return {
        file,
        oldPath,
        relativePath,
        targetPath: (0, obsidian.normalizePath)(`${nextPath}/${relativePath}`)
      };
    });
    const folderPaths = new Set<string>();
    for (const entry of entries) {
      const parts = entry.relativePath.split("/");
      parts.pop();
      let current = nextPath;
      for (const part of parts) {
        current = (0, obsidian.normalizePath)(`${current}/${part}`);
        folderPaths.add(current);
      }
      const existing = this.app.vault.getAbstractFileByPath(entry.targetPath);
      if (existing !== null) {
        throw new Error(`无法迁移日记目录：目标位置已有文件 ${entry.targetPath}`);
      }
    }
    const foldersToCreate = [...folderPaths].sort(
      (left, right) => left.split("/").length - right.split("/").length
    );
    for (const folderPath of foldersToCreate) {
      const existing = this.app.vault.getAbstractFileByPath(folderPath);
      if (existing !== null && !(existing instanceof obsidian.TFolder)) {
        throw new Error(`无法迁移日记目录：${folderPath} 已经是文件`);
      }
    }

    const createdFolders = [];
    const movedEntries = [];
    try {
      for (const folderPath of foldersToCreate) {
        if (this.app.vault.getAbstractFileByPath(folderPath) === null) {
          await this.app.vault.createFolder(folderPath);
          createdFolders.push(folderPath);
        }
      }
      for (const entry of entries) {
        await this.app.fileManager.renameFile(entry.file, entry.targetPath);
        movedEntries.push(entry);
      }
    } catch (error) {
      for (const entry of [...movedEntries].reverse()) {
        const movedFile = this.app.vault.getAbstractFileByPath(entry.targetPath);
        if (movedFile instanceof obsidian.TFile) {
          try {
            await this.app.fileManager.renameFile(movedFile, entry.oldPath);
          } catch {
            // Keep the original error; the notice will identify the migration failure.
          }
        }
      }
      for (const folderPath of [...createdFolders].reverse()) {
        const createdFolder = this.app.vault.getAbstractFileByPath(folderPath);
        if (createdFolder instanceof obsidian.TFolder && createdFolder.children.length === 0) {
          try {
            await this.app.fileManager.trashFile(createdFolder);
          } catch {
            // An empty helper folder is harmless if Obsidian still has it locked.
          }
        }
      }
      throw new Error(`迁移日记目录时中断：${errorMessage(error)}`);
    }

    for (const folder of [...sourceFolders].reverse()) {
      if (folder.children.length === 0) {
        await this.app.fileManager.trashFile(folder);
      }
    }
    return entries.length;
  }
  createQuestionAction(container, icon, label, disabled, action) {
    const button = container.createEl("button", {
      cls: "clickable-icon",
      attr: {
        type: "button",
        "aria-label": label,
        title: label
      }
    });
    (0, obsidian.setIcon)(button, icon);
    button.disabled = disabled;
    button.addEventListener("click", action);
  }
  createSection(title, description) {
    const section = this.containerEl.createEl("section", {
      cls: "mind-trace-settings-section"
    });
    new obsidian.Setting(section).setName(title).setDesc(description).setClass("mind-trace-settings-section-heading").setHeading();
    return section;
  }
  renderProviderCard(container) {
    container.empty();
    container.addClass("mind-trace-provider-card");
    const kind = this.plugin.settings.activeProvider;
    const configuration = this.plugin.settings.providers[kind];
    new obsidian.Setting(container).setName("模型服务").setDesc("选择当前用于追问、整理日记以及生成周报、月报的服务").addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "active-provider");
      for (const [value, label] of Object.entries(PROVIDER_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(kind).onChange(async (value) => {
        this.plugin.settings.activeProvider = value;
        await this.plugin.saveProviderSettings();
        this.renderProviderCard(container);
      });
    });
    const modelPresets = PROVIDER_MODEL_PRESETS[kind];
    const modelSetting = modelPresets !== void 0 || kind !== "openai-compatible" ? new obsidian.Setting(container).setName("模型与思考").setClass("mind-trace-model-setting") : null;
    if (modelPresets !== void 0) {
      const presetValues = new Set(modelPresets.map((preset) => preset.value));
      const customModel = !presetValues.has(configuration.model);
      modelSetting?.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "provider-model");
        for (const preset of modelPresets) {
          dropdown.addOption(preset.value, preset.label);
        }
        dropdown.addOption(CUSTOM_MODEL_OPTION, "自定义…");
        dropdown.setValue(customModel ? CUSTOM_MODEL_OPTION : configuration.model).onChange(async (value) => {
          configuration.model = value === CUSTOM_MODEL_OPTION ? "" : value;
          await this.plugin.saveProviderSettings();
          this.renderProviderCard(container);
        });
      });
    }
    if (modelSetting !== null && kind !== "openai-compatible") {
      modelSetting.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "provider-thinking");
        for (const [value, label] of Object.entries(THINKING_LABELS)) {
          dropdown.addOption(value, label);
        }
        dropdown.setValue(configuration.thinkingMode ?? "auto").onChange(async (value) => {
          configuration.thinkingMode = value;
          await this.plugin.saveProviderSettings();
        });
      });
    }
    const modelNameSetting = new obsidian.Setting(container).setName("具体模型名称").setClass("mind-trace-model-name-setting");
    if (kind === "openai-compatible") {
      modelNameSetting.setDesc("填写服务商支持的模型 ID。");
    }
    modelNameSetting.addText((text) => text.setPlaceholder("输入模型 ID").setValue(configuration.model).onChange(async (value) => {
      configuration.model = value.trim();
      await this.plugin.saveProviderSettings();
    }));
    const credentialSetting = new obsidian.Setting(container).setName("API key").setDesc(this.plugin.activeCredentialStatus());
    const refreshCredentialStatus = () => {
      credentialSetting.setDesc(this.plugin.activeCredentialStatus());
    };
    if (kind === "openai-compatible") {
      credentialSetting.addDropdown((dropdown) => {
        dropdown.selectEl.setAttribute("data-mind-trace-focus-key", "credential-source");
        dropdown.addOption("secret-storage", "Obsidian secret storage").addOption("none", "无需鉴权");
        dropdown.setValue(configuration.credentialSource).onChange(async (value) => {
          configuration.credentialSource = value;
          await this.plugin.saveProviderSettings();
          this.renderProviderCard(container);
        });
      });
    }
    if (kind !== "openai-compatible" || configuration.credentialSource === "secret-storage") {
      credentialSetting.addComponent((componentContainer) => new obsidian.SecretComponent(this.app, componentContainer).setValue(configuration.secretId).onChange(async (value) => {
        configuration.secretId = value;
        await this.plugin.saveProviderSettings();
        refreshCredentialStatus();
      }));
    }
    if (isChatCompletionsProvider(kind)) {
      new obsidian.Setting(container).setName("Base URL").setDesc("插件会在该地址后请求 chat/completions").addText(
        (text) => text.setPlaceholder(DEFAULT_SETTINGS.providers[kind].baseUrl).setValue(configuration.baseUrl).onChange(async (value) => {
          configuration.baseUrl = value.trim();
          await this.plugin.saveProviderSettings();
        })
      );
    }
    const testSetting = new obsidian.Setting(container).setName("测试连接").setDesc("发送一个最小请求，验证当前模型、地址和密钥");
    testSetting.addButton((button) => button.setButtonText("测试").setDisabled(this.connectionTestBusy).onClick(() => {
      void this.runConnectionTest(container, button);
    }));
  }
  async runConnectionTest(container, button) {
    if (this.connectionTestBusy) {
      return;
    }
    this.connectionTestBusy = true;
    button.setDisabled(true);
    container.querySelectorAll(".mind-trace-connection-task-status").forEach((element) => element.remove());
    const connectionStatus = container.createDiv({
      cls: "mind-trace-llm-inline-status mind-trace-connection-task-status",
      attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" }
    });
    const stopConnectionStatus = attachLlmActivityStatus(connectionStatus, this.plugin, "正在准备连接测试…");
    openMindTraceOperation(this.app, this.plugin, {
      eyebrow: "心迹设置 · 模型连接",
      title: "测试当前模型连接",
      description: "发送一个最小请求，验证模型名称、服务地址和鉴权信息。",
      confirm: false,
      stages: ["准备连接信息", "等待模型响应"],
      run: async (update, { signal }) => {
        update({ stage: 1, total: 2, title: "准备连接信息", detail: "正在检查当前模型与鉴权配置。" });
        const provider = this.plugin.createProvider(signal);
        update({ stage: 2, total: 2, title: "等待模型响应", detail: "已发送最小测试请求。" });
        return await provider.generate([
          { role: "user", content: "只回复：连接成功" }
        ], "test");
      },
      onSuccess: (response) => {
        stopConnectionStatus();
        connectionStatus.empty();
        connectionStatus.addClass("is-success");
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-primary", text: "模型连接正常" });
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-detail", text: response.trim().length > 0 ? response.trim().slice(0, 120) : "最小测试请求已成功完成。" });
        this.connectionTestBusy = false;
        button.setDisabled(false);
      },
      onError: (error) => {
        stopConnectionStatus();
        connectionStatus.empty();
        connectionStatus.addClass("is-error");
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-primary", text: "模型连接失败" });
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-detail", text: errorMessage(error) });
        this.connectionTestBusy = false;
        button.setDisabled(false);
      },
      onCancel: () => {
        stopConnectionStatus();
        connectionStatus.empty();
        connectionStatus.addClass("is-error");
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-primary", text: "连接测试已取消" });
        connectionStatus.createSpan({ cls: "mind-trace-llm-status-detail", text: "已停止等待模型响应。" });
        this.connectionTestBusy = false;
        button.setDisabled(false);
      },
      successTitle: "模型连接正常",
      successDetail: (response) => response.trim().length > 0 ? `模型响应：${response.trim().slice(0, 120)}` : "请求成功完成。",
      successLabel: "返回设置",
      backgroundSuccess: "模型连接测试成功"
    });
  }
};
