export class MoneyUnifyClient {
  private baseUrl = "https://api.moneyunify.one/payments";
  private authId: string;

  constructor(authId?: string) {
    this.authId = authId || process.env.MONEYUNIFY_AUTH_ID || "";
    if (!this.authId) {
      throw new Error("MoneyUnify Auth ID is required (MONEYUNIFY_AUTH_ID)");
    }
  }

  async requestPayment(amount: number, fromPayer: string) {
    const params = new URLSearchParams();
    params.append("from_payer", fromPayer);
    params.append("amount", amount.toString());
    params.append("auth_id", this.authId);

    const res = await fetch(`${this.baseUrl}/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MoneyUnify Request Failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  async verifyPayment(transactionId: string) {
    const params = new URLSearchParams();
    params.append("transaction_id", transactionId);
    params.append("auth_id", this.authId);

    const res = await fetch(`${this.baseUrl}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MoneyUnify Verify Failed: ${res.status} ${text}`);
    }

    return res.json();
  }
}
