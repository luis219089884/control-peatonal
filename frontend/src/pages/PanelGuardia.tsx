import { useQuery } from '@apollo/client'
import { MI_PANEL_GUARDIA_QUERY } from '../graphql/queries'
import PanelGuardiaOperativo from '../components/panel/PanelGuardiaOperativo'

export default function PanelGuardia() {
  const { data, loading, refetch } = useQuery(MI_PANEL_GUARDIA_QUERY, {
    fetchPolicy: 'network-only',
  })

  const panel = data?.miPanelGuardia

  return (
    <PanelGuardiaOperativo
      modo="guardia"
      panel={panel}
      loadingPanel={loading}
      idIngreso={panel?.ingresoId ?? 0}
      onRefetch={refetch}
    />
  )
}
