/**
 * The portal's "what should we call you?" prompt, inside the widget.
 *
 * Same component and the same server functions as the portal, authenticated
 * with the widget's Bearer session instead of the portal cookie, so saving
 * updates the account and writes the first/last name back to the person's own
 * Entra profile exactly as the portal does. Only identified visitors are asked:
 * an anonymous widget session has no account to name.
 */
import { NamePrompt } from '@/components/portal/name-prompt'
import { getWidgetAuthHeaders } from '@/lib/client/widget-auth'
import { useWidgetAuth } from './widget-auth-provider'

export function WidgetNamePrompt() {
  const { isIdentified, identityResolved, sessionVersion } = useWidgetAuth()
  return (
    <NamePrompt
      enabled={isIdentified && identityResolved}
      getHeaders={getWidgetAuthHeaders}
      queryKey={['widget', 'me', 'name', sessionVersion]}
    />
  )
}
