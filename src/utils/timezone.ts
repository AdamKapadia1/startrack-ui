export function formatTime(utcSecs: number, timezone: string): string {
  try {
    return new Date(utcSecs * 1000).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: timezone,
    });
  } catch {
    return new Date(utcSecs * 1000).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
    });
  }
}

export function formatDate(utcSecs: number, timezone: string): string {
  try {
    return new Date(utcSecs * 1000).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone,
    });
  } catch {
    return new Date(utcSecs * 1000).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London',
    });
  }
}

export function tzLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

export const COMMON_TIMEZONES: { label: string; value: string }[] = [
  { label: 'London (GMT/BST)',          value: 'Europe/London'        },
  { label: 'Dublin (GMT/IST)',           value: 'Europe/Dublin'        },
  { label: 'Paris / Berlin (CET)',       value: 'Europe/Paris'         },
  { label: 'Helsinki (EET)',             value: 'Europe/Helsinki'      },
  { label: 'Moscow (MSK)',               value: 'Europe/Moscow'        },
  { label: 'Dubai (GST)',                value: 'Asia/Dubai'           },
  { label: 'Mumbai (IST)',               value: 'Asia/Kolkata'         },
  { label: 'Singapore / KL (SGT)',       value: 'Asia/Singapore'       },
  { label: 'Tokyo (JST)',                value: 'Asia/Tokyo'           },
  { label: 'Sydney (AEDT/AEST)',         value: 'Australia/Sydney'     },
  { label: 'Auckland (NZDT/NZST)',       value: 'Pacific/Auckland'     },
  { label: 'UTC',                        value: 'UTC'                  },
  { label: 'New York (ET)',              value: 'America/New_York'     },
  { label: 'Chicago (CT)',               value: 'America/Chicago'      },
  { label: 'Denver (MT)',                value: 'America/Denver'       },
  { label: 'Los Angeles (PT)',           value: 'America/Los_Angeles'  },
  { label: 'Anchorage (AKT)',            value: 'America/Anchorage'    },
  { label: 'Honolulu (HST)',             value: 'Pacific/Honolulu'     },
  { label: 'São Paulo (BRT)',            value: 'America/Sao_Paulo'    },
  { label: 'Buenos Aires (ART)',         value: 'America/Argentina/Buenos_Aires' },
  { label: 'Johannesburg (SAST)',        value: 'Africa/Johannesburg'  },
  { label: 'Nairobi (EAT)',              value: 'Africa/Nairobi'       },
];
