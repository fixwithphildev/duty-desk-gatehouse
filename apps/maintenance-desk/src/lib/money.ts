// Naira amounts as people at the property write them: ₦35,000.
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export const damageTotal = (d: { charge: number }[]) => d.reduce((s, x) => s + (Number(x.charge) || 0), 0);
