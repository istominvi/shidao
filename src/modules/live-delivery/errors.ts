export class LiveDeliveryRepositoryError extends Error {
  readonly name = "LiveDeliveryRepositoryError";

  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export class LiveDeliveryProjectionError extends Error {
  readonly name = "LiveDeliveryProjectionError";
  readonly code = "live_delivery_projection_invalid";

  constructor(message = "Live delivery source failed safe projection.") {
    super(message);
  }
}

export class LiveDeliveryAssetNotFoundError extends Error {
  readonly name = "LiveDeliveryAssetNotFoundError";
  readonly code = "live_delivery_asset_not_found";

  constructor() {
    super("Live delivery asset is unavailable.");
  }
}

export class LiveDeliveryAssetRangeError extends Error {
  readonly name = "LiveDeliveryAssetRangeError";
  readonly code = "live_delivery_asset_range_invalid";

  constructor(readonly sizeBytes: number) {
    super("Live delivery asset range is invalid.");
  }
}
