import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'

const graphqlUri =
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8000/graphql/'

const httpLink = createHttpLink({
  uri: graphqlUri,
})

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('uagrm_token')
  return {
    headers: {
      ...headers,
      Authorization: token ? `Bearer ${token}` : '',
    },
  }
})

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message }) => {
      if (message === 'No autenticado') {
        localStorage.removeItem('uagrm_token')
        window.location.href = '/login'
      }
    })
  }
  if (networkError) console.error('Error de red:', networkError)
})

export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
})
