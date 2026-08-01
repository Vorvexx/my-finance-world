"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AccountType = "asset" | "liability";

type GroupKey =
  | "cash"
  | "investments"
  | "property"
  | "debts"
  | "other";

type FinancialAccount = {
  id: string;
  name: string;
  institution: string;
  balance: number;
  type: AccountType;
  group: GroupKey;
  updatedAt: string;
};

type AccountForm = {
  name: string;
  institution: string;
  balance: string;
  type: AccountType;
  group: GroupKey;
};

type GroupDefinition = {
  key: GroupKey;
  name: string;
  description: string;
  defaultType: AccountType;
  x: number;
  y: number;
};

const STORAGE_KEY = "my-finance-world-real-accounts-v1";
const UPDATED_KEY = "my-finance-world-last-updated-v1";

const groups: GroupDefinition[] = [
  {
    key: "cash",
    name: "Cash",
    description: "Chequing and savings",
    defaultType: "asset",
    x: 15,
    y: 25,
  },
  {
    key: "investments",
    name: "Investments",
    description: "TFSA, RRSP and pensions",
    defaultType: "asset",
    x: 84,
    y: 22,
  },
  {
    key: "property",
    name: "Property",
    description: "Home, vehicle and valuables",
    defaultType: "asset",
    x: 84,
    y: 69,
  },
  {
    key: "debts",
    name: "Debts",
    description: "Mortgage, loans and cards",
    defaultType: "liability",
    x: 50,
    y: 87,
  },
  {
    key: "other",
    name: "Other",
    description: "Other assets or liabilities",
    defaultType: "asset",
    x: 15,
    y: 69,
  },
];

const emptyForm: AccountForm = {
  name: "",
  institution: "",
  balance: "",
  type: "asset",
  group: "cash",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

const formatExactCurrency = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const accountPositions = [
  { x: 18, y: 24 },
  { x: 50, y: 14 },
  { x: 82, y: 24 },
  { x: 86, y: 61 },
  { x: 66, y: 82 },
  { x: 34, y: 82 },
  { x: 14, y: 61 },
  { x: 50, y: 92 },
];

export default function Home() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedGroup, setSelectedGroup] =
    useState<GroupKey | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const [lastUpdated, setLastUpdated] = useState("No data entered yet");

  useEffect(() => {
    const savedAccounts = localStorage.getItem(STORAGE_KEY);
    const savedUpdatedTime = localStorage.getItem(UPDATED_KEY);

    if (savedAccounts) {
      try {
        const parsedAccounts = JSON.parse(
          savedAccounts,
        ) as FinancialAccount[];

        setAccounts(parsedAccounts);
      } catch {
        setAccounts([]);
      }
    }

    if (savedUpdatedTime) {
      setLastUpdated(savedUpdatedTime);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts, loaded]);

  const assets = useMemo(
    () => accounts.filter((account) => account.type === "asset"),
    [accounts],
  );

  const liabilities = useMemo(
    () => accounts.filter((account) => account.type === "liability"),
    [accounts],
  );

  const totalAssets = useMemo(
    () => assets.reduce((total, account) => total + account.balance, 0),
    [assets],
  );

  const totalLiabilities = useMemo(
    () =>
      liabilities.reduce(
        (total, account) => total + account.balance,
        0,
      ),
    [liabilities],
  );

  const netWorth = totalAssets - totalLiabilities;

  const selectedGroupDefinition = groups.find(
    (group) => group.key === selectedGroup,
  );

  const selectedGroupAccounts = useMemo(
    () =>
      selectedGroup
        ? accounts.filter((account) => account.group === selectedGroup)
        : [],
    [accounts, selectedGroup],
  );

  const updateTimestamp = () => {
    const timestamp = new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    setLastUpdated(timestamp);
    localStorage.setItem(UPDATED_KEY, timestamp);

    return timestamp;
  };

  const openNewAccountForm = (group: GroupKey = "cash") => {
    const selectedDefinition = groups.find(
      (groupDefinition) => groupDefinition.key === group,
    );

    setEditingId(null);

    setForm({
      name: "",
      institution: "",
      balance: "",
      group,
      type: selectedDefinition?.defaultType ?? "asset",
    });

    setIsModalOpen(true);
  };

  const openEditForm = (account: FinancialAccount) => {
    setEditingId(account.id);

    setForm({
      name: account.name,
      institution: account.institution,
      balance: String(account.balance),
      type: account.type,
      group: account.group,
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleGroupClick = (group: GroupDefinition) => {
    const groupAccounts = accounts.filter(
      (account) => account.group === group.key,
    );

    if (groupAccounts.length === 0) {
      openNewAccountForm(group.key);
      return;
    }

    setSelectedGroup(group.key);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedBalance = Number(
      form.balance.replace(/[$,\s]/g, ""),
    );

    if (
      !form.name.trim() ||
      Number.isNaN(normalizedBalance) ||
      normalizedBalance < 0
    ) {
      return;
    }

    const timestamp = updateTimestamp();

    if (editingId) {
      setAccounts((currentAccounts) =>
        currentAccounts.map((account) =>
          account.id === editingId
            ? {
                ...account,
                name: form.name.trim(),
                institution: form.institution.trim(),
                balance: normalizedBalance,
                type: form.type,
                group: form.group,
                updatedAt: timestamp,
              }
            : account,
        ),
      );
    } else {
      const newAccount: FinancialAccount = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        institution: form.institution.trim(),
        balance: normalizedBalance,
        type: form.type,
        group: form.group,
        updatedAt: timestamp,
      };

      setAccounts((currentAccounts) => [
        ...currentAccounts,
        newAccount,
      ]);

      setSelectedGroup(form.group);
    }

    closeModal();
  };

  const deleteAccount = () => {
    if (!editingId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this financial account?",
    );

    if (!confirmed) {
      return;
    }

    setAccounts((currentAccounts) =>
      currentAccounts.filter((account) => account.id !== editingId),
    );

    updateTimestamp();
    closeModal();
  };

  const deleteAllData = () => {
    const confirmed = window.confirm(
      "Delete every financial account and restart from zero?",
    );

    if (!confirmed) {
      return;
    }

    setAccounts([]);
    setSelectedGroup(null);
    setLastUpdated("No data entered yet");

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UPDATED_KEY);
  };

  const getGroupAccounts = (group: GroupKey) =>
    accounts.filter((account) => account.group === group);

  const getGroupTotal = (group: GroupKey) => {
    const groupAccounts = getGroupAccounts(group);

    return groupAccounts.reduce((total, account) => {
      if (account.type === "asset") {
        return total + account.balance;
      }

      return total - account.balance;
    }, 0);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#020713] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="flex items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
              My Finance World
            </p>

            <h1 className="mt-3 text-2xl font-semibold md:text-3xl">
              Good afternoon, Inder.
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Last updated: {lastUpdated}
            </p>
          </div>

          <button
            onClick={() =>
              openNewAccountForm(selectedGroup ?? "cash")
            }
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            Add financial data
          </button>
        </header>

        <section className="relative mt-8 min-h-[700px] overflow-hidden rounded-[40px] border border-white/10 bg-[#061022] shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_42%)]" />

          <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/10" />

          <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />

          {selectedGroup && (
            <button
              onClick={() => setSelectedGroup(null)}
              className="absolute left-6 top-6 z-40 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300 backdrop-blur hover:bg-white/10 hover:text-white"
            >
              ← Back to overview
            </button>
          )}

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="0.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {!selectedGroup &&
              groups.map((group) => {
                const groupAccounts = getGroupAccounts(group.key);

                if (groupAccounts.length === 0) {
                  return null;
                }

                const groupTotal = getGroupTotal(group.key);
                const isAssetFlow = groupTotal >= 0;

                return (
                  <g key={group.key}>
                    <line
                      x1={group.x}
                      y1={group.y}
                      x2="50"
                      y2="50"
                      stroke={
                        isAssetFlow ? "#34d399" : "#fb7185"
                      }
                      strokeOpacity="0.75"
                      strokeWidth="0.35"
                      strokeDasharray="1.2 1.2"
                      filter="url(#lineGlow)"
                    />

                    <circle
                      r="0.6"
                      fill={
                        isAssetFlow ? "#34d399" : "#fb7185"
                      }
                    >
                      <animateMotion
                        dur={isAssetFlow ? "4s" : "4.5s"}
                        repeatCount="indefinite"
                        path={
                          isAssetFlow
                            ? `M ${group.x} ${group.y} L 50 50`
                            : `M 50 50 L ${group.x} ${group.y}`
                        }
                      />
                    </circle>
                  </g>
                );
              })}

            {selectedGroup &&
              selectedGroupAccounts
                .slice(0, accountPositions.length)
                .map((account, index) => {
                  const position = accountPositions[index];

                  return (
                    <g key={account.id}>
                      <line
                        x1={position.x}
                        y1={position.y}
                        x2="50"
                        y2="50"
                        stroke={
                          account.type === "asset"
                            ? "#34d399"
                            : "#fb7185"
                        }
                        strokeOpacity="0.75"
                        strokeWidth="0.35"
                        strokeDasharray="1.2 1.2"
                        filter="url(#lineGlow)"
                      />

                      <circle
                        r="0.6"
                        fill={
                          account.type === "asset"
                            ? "#34d399"
                            : "#fb7185"
                        }
                      >
                        <animateMotion
                          dur={`${3.5 + index * 0.35}s`}
                          repeatCount="indefinite"
                          path={
                            account.type === "asset"
                              ? `M ${position.x} ${position.y} L 50 50`
                              : `M 50 50 L ${position.x} ${position.y}`
                          }
                        />
                      </circle>
                    </g>
                  );
                })}
          </svg>

          <div className="absolute left-1/2 top-1/2 z-20 flex h-64 w-64 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-center shadow-[0_0_90px_rgba(16,185,129,0.22)] backdrop-blur-xl">
            <div className="absolute inset-3 rounded-full border border-white/5" />

            <p className="relative text-sm text-emerald-200">
              {selectedGroupDefinition
                ? selectedGroupDefinition.name
                : "Your net worth"}
            </p>

            <p className="relative mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              {selectedGroup
                ? formatCurrency(
                    getGroupTotal(selectedGroup),
                  )
                : formatCurrency(netWorth)}
            </p>

            <p
              className={`relative mt-3 text-sm font-medium ${
                selectedGroup
                  ? getGroupTotal(selectedGroup) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                  : netWorth >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
              }`}
            >
              {selectedGroup
                ? `${selectedGroupAccounts.length} account${
                    selectedGroupAccounts.length === 1 ? "" : "s"
                  }`
                : accounts.length === 0
                  ? "Click a floating ball to begin"
                  : netWorth >= 0
                    ? "Assets exceed liabilities"
                    : "Liabilities exceed assets"}
            </p>
          </div>

          {!selectedGroup &&
            groups.map((group, index) => {
              const groupAccounts = getGroupAccounts(group.key);
              const groupTotal = getGroupTotal(group.key);
              const isEmpty = groupAccounts.length === 0;
              const isPositive = groupTotal >= 0;

              return (
                <button
                  key={group.key}
                  onClick={() => handleGroupClick(group)}
                  style={{
                    left: `${group.x}%`,
                    top: `${group.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className={`absolute z-20 flex h-36 w-36 flex-col items-center justify-center rounded-full border text-center backdrop-blur-xl transition duration-300 hover:scale-110 md:h-40 md:w-40 ${
                    isEmpty
                      ? "border-dashed border-slate-500/40 bg-white/[0.03]"
                      : isPositive
                        ? "border-emerald-400/35 bg-emerald-400/10 shadow-[0_0_35px_rgba(16,185,129,0.13)]"
                        : "border-rose-400/35 bg-rose-400/10 shadow-[0_0_35px_rgba(244,63,94,0.13)]"
                  } ${
                    index % 2 === 0
                      ? "animate-[float_5s_ease-in-out_infinite]"
                      : "animate-[float_6s_ease-in-out_infinite_reverse]"
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isEmpty
                        ? "text-slate-500"
                        : isPositive
                          ? "text-emerald-300"
                          : "text-rose-300"
                    }`}
                  >
                    {groupAccounts.length === 0
                      ? "Click to add"
                      : `${groupAccounts.length} account${
                          groupAccounts.length === 1 ? "" : "s"
                        }`}
                  </span>

                  <span className="mt-2 font-semibold">
                    {group.name}
                  </span>

                  <span className="mt-1 max-w-[110px] text-xs text-slate-400">
                    {isEmpty
                      ? group.description
                      : formatCurrency(groupTotal)}
                  </span>
                </button>
              );
            })}

          {selectedGroup &&
            selectedGroupAccounts
              .slice(0, accountPositions.length)
              .map((account, index) => {
                const position = accountPositions[index];

                return (
                  <button
                    key={account.id}
                    onClick={() => openEditForm(account)}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    className={`absolute z-20 flex h-36 w-36 flex-col items-center justify-center rounded-full border text-center backdrop-blur-xl transition duration-300 hover:scale-110 md:h-40 md:w-40 ${
                      account.type === "asset"
                        ? "border-emerald-400/35 bg-emerald-400/10 shadow-[0_0_35px_rgba(16,185,129,0.13)]"
                        : "border-rose-400/35 bg-rose-400/10 shadow-[0_0_35px_rgba(244,63,94,0.13)]"
                    } ${
                      index % 2 === 0
                        ? "animate-[float_5s_ease-in-out_infinite]"
                        : "animate-[float_6s_ease-in-out_infinite_reverse]"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        account.type === "asset"
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {account.institution ||
                        (account.type === "asset"
                          ? "Asset"
                          : "Liability")}
                    </span>

                    <span className="mt-2 max-w-[125px] font-semibold">
                      {account.name}
                    </span>

                    <span className="mt-1 text-sm text-slate-300">
                      {formatCurrency(account.balance)}
                    </span>
                  </button>
                );
              })}

          {selectedGroup && (
            <button
              onClick={() => openNewAccountForm(selectedGroup)}
              className="absolute bottom-7 right-7 z-30 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-emerald-400/50 bg-emerald-400/10 text-4xl font-light text-emerald-300 transition hover:scale-110 hover:bg-emerald-400/20"
              aria-label="Add another account"
            >
              +
            </button>
          )}

          <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-6 rounded-full border border-white/10 bg-black/30 px-6 py-3 text-xs backdrop-blur">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Assets flow in
            </span>

            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Liabilities flow out
            </span>
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">Total assets</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {formatExactCurrency(totalAssets)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Total liabilities
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-300">
              {formatExactCurrency(totalLiabilities)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">Net worth</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                netWorth >= 0
                  ? "text-emerald-300"
                  : "text-rose-300"
              }`}
            >
              {formatExactCurrency(netWorth)}
            </p>
          </div>
        </section>

        {accounts.length > 0 && (
          <div className="mt-6 text-right">
            <button
              onClick={deleteAllData}
              className="text-sm text-slate-600 hover:text-rose-400"
            >
              Delete all financial data
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#081225] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-emerald-400">
                  Financial account
                </p>

                <h2 className="mt-1 text-2xl font-semibold">
                  {editingId
                    ? "Update account"
                    : "Add financial data"}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Enter the latest accurate balance.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="group"
                  className="text-sm text-slate-300"
                >
                  Category
                </label>

                <select
                  id="group"
                  value={form.group}
                  onChange={(event) => {
                    const nextGroup = event.target.value as GroupKey;
                    const groupDefinition = groups.find(
                      (group) => group.key === nextGroup,
                    );

                    setForm((current) => ({
                      ...current,
                      group: nextGroup,
                      type:
                        nextGroup === "other"
                          ? current.type
                          : groupDefinition?.defaultType ??
                            current.type,
                    }));
                  }}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#050b17] px-4 py-3 outline-none focus:border-emerald-400"
                >
                  {groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300">
                  Balance type
                </label>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        type: "asset",
                      }))
                    }
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      form.type === "asset"
                        ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
                        : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    Asset
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        type: "liability",
                      }))
                    }
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      form.type === "liability"
                        ? "border-rose-400 bg-rose-400/10 text-rose-300"
                        : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    Liability
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="account-name"
                  className="text-sm text-slate-300"
                >
                  Account name
                </label>

                <input
                  id="account-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: TD Chequing"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400"
                />
              </div>

              <div>
                <label
                  htmlFor="institution"
                  className="text-sm text-slate-300"
                >
                  Institution or provider
                </label>

                <input
                  id="institution"
                  value={form.institution}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      institution: event.target.value,
                    }))
                  }
                  placeholder="Example: TD Bank"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-emerald-400"
                />
              </div>

              <div>
                <label
                  htmlFor="account-balance"
                  className="text-sm text-slate-300"
                >
                  Current balance
                </label>

                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    id="account-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.balance}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        balance: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-8 pr-4 outline-none placeholder:text-slate-600 focus:border-emerald-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                {editingId ? "Save changes" : "Add account"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={deleteAccount}
                  className="w-full rounded-xl border border-rose-400/20 px-5 py-3 text-sm text-rose-300 transition hover:bg-rose-400/10"
                >
                  Delete account
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            margin-top: 0;
          }

          50% {
            margin-top: -12px;
          }
        }
      `}</style>
    </main>
  );
}