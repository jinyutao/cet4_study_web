interface LoadingSkeletonProps {
  type: 'card' | 'table' | 'chart' | 'text'
  count?: number
  height?: string
}

function CardSkeleton() {
  return <div className="bg-gray-100 animate-pulse rounded-2xl h-32" />
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-3 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" />
          <div className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton({ height }: { height?: string }) {
  return (
    <div
      className="bg-gray-100 animate-pulse rounded-2xl"
      style={{ height: height || '10rem' }}
    />
  )
}

function TextSkeleton() {
  return <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
}

export default function LoadingSkeleton({
  type,
  count = 1,
  height,
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count })

  return (
    <div className="space-y-4">
      {items.map((_, i) => {
        switch (type) {
          case 'card':
            return <CardSkeleton key={i} />
          case 'table':
            return <TableSkeleton key={i} />
          case 'chart':
            return <ChartSkeleton key={i} height={height} />
          case 'text':
            return <TextSkeleton key={i} />
        }
      })}
    </div>
  )
}
