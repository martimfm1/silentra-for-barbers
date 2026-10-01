      stripe_customer_id: customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan,
      status: subscription.status,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      payment_method: 'STRIPE',
      updated_at: new Date().toISOString(),
    };

    const write = existing
      ? await database
          .from('subscriptions')
          .update(payload)
          .eq('id', existing.id)
      : await database
          .from('subscriptions')
          .upsert(payload, { onConflict: 'barbershop_id' });
    if (write.error)
      throw new BillingError(
        'Could not persist subscription state.',
        'DB_WRITE_FAILED',
      );
  }

  static async findBarbershopByCustomerId(
    customer: string,
  ): Promise<{ barbershopId: string; ownerUserId: string } | null> {
    const database = createAdminClient();
    const { data, error } = await database
      .from('barbershop_billing_accounts')
      .select('barbershop_id, billing_owner_user_id')
      .eq('stripe_customer_id', customer)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not resolve Stripe customer mapping.',
        'DB_READ_FAILED',
      );
    if (data?.barbershop_id && data.billing_owner_user_id) {
      const { data: owner, error: ownerError } = await database
        .from('users')
        .select('id, barbershop_id, role')