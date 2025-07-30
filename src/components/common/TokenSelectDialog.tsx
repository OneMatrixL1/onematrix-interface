import {
  Box,
  Button,
  ButtonProps,
  Center,
  CloseButton,
  Dialog,
  Flex,
  Image,
  Input,
  Portal,
  SkeletonCircle,
  SkeletonText,
  Spinner,
  Stack,
  Text,
  useDialog,
} from "@chakra-ui/react"
import { Chain } from "@rainbow-me/rainbowkit"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useDebounce } from "@uidotdev/usehooks"
import { InfiniteScroller } from "components/common"
import { ERC20Abi } from "contracts/abis"
import { uniqBy } from "lodash"
import { useEffect, useMemo, useState } from "react"
import { MdExpandMore } from "react-icons/md"
import { devnetService, kyberService } from "services"
import { createOFTAdapter } from "services/oft"
import { useTokensStore } from "store/tokensStore"
import { createPublicClient, http, isAddress, zeroAddress } from "viem"
import { useAccount, useWalletClient } from "wagmi"

type Props = {
  buttonProps?: ButtonProps
  feature?: Feature
  fromChain?: Chain | null
  isDevnet?: boolean
  onChange?: (chain: null | Token) => void
  value?: null | Token
}

const TokenSelectDialog = ({ buttonProps, feature, fromChain, isDevnet, onChange, value }: Props) => {
  const dialog = useDialog()
  const { chainId } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [searchText, setSearchText] = useState("")
  const [currentToken, setCurrentToken] = useState<null | Token>(null)
  const [creatingAdapter, setCreatingAdapter] = useState<boolean>(false)

  const debouncedSearchText = useDebounce(searchText, 300)

  const selectedToken = value !== undefined ? value : currentToken

  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery({
    getNextPageParam: (lastPage: TokensPagination, allPages) => {
      const maxPage = Math.ceil(lastPage.pagination.totalItems / 20)
      const nextPage = allPages.length + 1
      if (nextPage > maxPage) return undefined
      return nextPage
    },
    initialPageParam: 1,
    queryFn: ({ pageParam: page }) => {
      const service = isDevnet ? devnetService : kyberService
      return service.fetchTokens({
        chainId: isDevnet ? fromChain!.id! : chainId!,
        feature,
        page,
        pageSize: 20,
        query: debouncedSearchText,
        walletClient,
      })
    },
    queryKey: ["kyberService.fetchTokens", { chainId, feature, fromChain, query: debouncedSearchText }],
  })

  const { addToken, tokens: importedTokens } = useTokensStore()

  const [fetchedTokens, setFetchedTokens] = useState<Token[]>(importedTokens)
  const [loadingTokens, setLoadingTokens] = useState(false)

  const availableTokens = useMemo(() => {
    let allTokens = (data?.pages.flatMap((page) => page.tokens) ?? []).concat(fetchedTokens)
    if (isAddress(debouncedSearchText)) {
      allTokens = allTokens.filter((token) => token.address === debouncedSearchText)
    }
    return allTokens
  }, [data, fetchedTokens, debouncedSearchText])

  useEffect(() => {
    const getTokenInfo = async (chain: Chain, tokenAddress: Address) => {
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(),
      })

      setLoadingTokens(true)
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({ abi: ERC20Abi, address: tokenAddress, functionName: "symbol" }),
        publicClient.readContract({ abi: ERC20Abi, address: tokenAddress, functionName: "decimals" }),
      ]).finally(() => {
        setLoadingTokens(false)
      })

      const newToken = {
        address: tokenAddress,
        chainId: chain.id,
        decimals,
        isImport: true,
        logoURI: "https://sepolia.arbiscan.io/assets/arbsepolia/images/svg/empty-token.svg?v=25.5.4.0",
        name: symbol,
        symbol,
      } as Token

      setFetchedTokens((tokens) => {
        return uniqBy(tokens.concat(newToken), "address")
      })
    }

    if (fromChain && isAddress(debouncedSearchText)) {
      getTokenInfo(fromChain, debouncedSearchText)
    }
  }, [fromChain, debouncedSearchText, addToken])

  return (
    <Dialog.RootProvider placement="top" scrollBehavior="inside" size="sm" value={dialog}>
      <Dialog.Trigger asChild>
        <Button px={selectedToken ? 1 : undefined} rounded="full" size="xs" variant="outline" {...buttonProps}>
          {selectedToken ? (
            <>
              <Image h={6} rounded="full" src={selectedToken.logoURI} w={6} />
              {selectedToken.symbol}
            </>
          ) : (
            "Select Token"
          )}
          <MdExpandMore />
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mt={120} mx={3}>
            <Dialog.Header>
              <Dialog.Title>Select a Token</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body maxH={600} overflowY="scroll" pr={4} pt={0}>
              <InfiniteScroller
                hasMore={!!hasNextPage}
                loadMore={() => {
                  if (!isFetching) fetchNextPage()
                }}
                useWindow={false}
              >
                <Box backgroundColor="bg.panel" pb={2} position="sticky" top={0} zIndex={1}>
                  <Input
                    colorPalette="purple"
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search by token name, symbol or address"
                    rounded="full"
                    size="xl"
                    value={searchText}
                  />
                </Box>
                <Stack gap={2} minH={240}>
                  {availableTokens.map((token) => {
                    const isSelected = token.address === selectedToken?.address
                    return (
                      <Button
                        borderRadius={8}
                        colorPalette={isSelected ? "purple" : "gray"}
                        justifyContent="flex-start"
                        key={`${token.chainId}/${token.address}`}
                        minH={12}
                        onClick={async () => {
                          try {
                            let _token = { ...token }
                            const noBridge = Object.values(token?.bridges ?? {}).some((i) => i === zeroAddress)
                            if (noBridge) {
                              setCreatingAdapter(true)
                              const bridges = await createOFTAdapter(
                                (isDevnet ? fromChain?.id : chainId) as number,
                                token.address,
                                walletClient,
                              )
                              _token = { ...token, bridges }
                            }
                            setCurrentToken(_token)
                            onChange?.(_token)
                            if (token.isImport) addToken(_token)
                            dialog.setOpen(false)
                            setCreatingAdapter(false)
                          } catch (error) {
                            setCreatingAdapter(false)
                          }
                        }}
                        overflow="hidden"
                        px={2}
                        variant={isSelected ? "subtle" : "ghost"}
                      >
                        <Image h={6} rounded="full" src={token.logoURI} w={6} />
                        <Box flex={1} overflow="hidden" textAlign="left">
                          <Text>{token.symbol}</Text>
                          <Flex flex={1} gap={4} justifyContent="space-between">
                            <Text color="textSecondary" fontSize="xs" fontWeight="normal" truncate={true}>
                              {token.name}
                            </Text>
                            <Text color="textSecondary" fontSize="xs" fontWeight="normal">
                              ChainID: {token.chainId}
                            </Text>
                          </Flex>
                        </Box>

                        {Object.values(token?.bridges ?? {}).some((i) => i === zeroAddress) ? (
                          <>{creatingAdapter ? <Spinner /> : <Text>Create Adapter</Text>}</>
                        ) : null}
                      </Button>
                    )
                  })}

                  {(isFetching || loadingTokens) && (
                    <Flex alignItems="center" gap={2} h={12} px={1}>
                      <SkeletonCircle size={8} />
                      <SkeletonText noOfLines={2} />
                    </Flex>
                  )}

                  {data?.pages[0]?.pagination.totalItems === 0 && (
                    <Center h={12}>
                      <Text color="textSecondary">No results found.</Text>
                    </Center>
                  )}
                </Stack>
              </InfiniteScroller>
            </Dialog.Body>

            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.RootProvider>
  )
}

export default TokenSelectDialog
