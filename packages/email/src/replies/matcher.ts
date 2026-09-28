export interface InboundEmailMetadata {
  to?: string;
  from?: string;
  subject?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}

export interface ReplyMatchCandidate {
  type: 'ALIAS_TOKEN' | 'INTERNET_MESSAGE_ID' | 'THREAD_ID';
  key: string;
}

/**
 * Extracts candidate correlation keys from an inbound reply email
 * without parsing or storing the email body.
 */
export function extractReplyCorrelationKeys(metadata: InboundEmailMetadata): ReplyMatchCandidate[] {
  const candidates: ReplyMatchCandidate[] = [];

  // 1. Check for plus-addressing / sub-addressing: reply+<token>@domain
  if (metadata.to) {
    const match = metadata.to.match(/reply\+([a-zA-Z0-9_-]+)@/i);
    if (match && match[1]) {
      candidates.push({
        type: 'ALIAS_TOKEN',
        key: match[1],
      });
    }
  }

  // 2. Check for RFC 2822 In-Reply-To header
  if (metadata.inReplyTo) {
    const cleanId = metadata.inReplyTo.trim().replace(/^<|>$/g, '');
    if (cleanId) {
      candidates.push({
        type: 'INTERNET_MESSAGE_ID',
        key: cleanId,
      });
    }
  }

  // 3. Check for RFC 2822 References header (multiple Message-IDs)
  if (metadata.references) {
    const ids = metadata.references.match(/<([^>]+)>/g);
    if (ids) {
      for (const id of ids) {
        const cleanId = id.replace(/^<|>$/g, '');
        if (cleanId && !candidates.some((c) => c.key === cleanId)) {
          candidates.push({
            type: 'INTERNET_MESSAGE_ID',
            key: cleanId,
          });
        }
      }
    }
  }

  // 4. Provider thread ID
  if (metadata.threadId) {
    candidates.push({
      type: 'THREAD_ID',
      key: metadata.threadId,
    });
  }

  return candidates;
}
