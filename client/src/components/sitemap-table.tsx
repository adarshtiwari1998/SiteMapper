import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import type { DiscoveredPage } from "@shared/schema";
import { 
  Home, 
  Info, 
  ShoppingCart, 
  Mail, 
  FileText, 
  Users, 
  DollarSign,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface SitemapTableProps {
  pages: DiscoveredPage[];
  totalPages: number;
  jobId: string;
}

export default function SitemapTable({ pages, totalPages, jobId }: SitemapTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalTablePages = Math.ceil(pages.length / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPages = pages.slice(startIndex, endIndex);

  const getPageTypeIcon = (type?: string) => {
    switch (type) {
      case 'homepage':
        return <Home className="h-4 w-4 text-primary" />;
      case 'about':
        return <Info className="h-4 w-4 text-primary" />;
      case 'contact':
        return <Mail className="h-4 w-4 text-primary" />;
      case 'product':
        return <ShoppingCart className="h-4 w-4 text-primary" />;
      case 'team':
        return <Users className="h-4 w-4 text-primary" />;
      case 'pricing':
        return <DollarSign className="h-4 w-4 text-primary" />;
      default:
        return <FileText className="h-4 w-4 text-primary" />;
    }
  };

  const getPageTypeBadge = (type?: string) => {
    const colorMap: Record<string, string> = {
      'homepage': 'bg-blue-100 text-blue-800',
      'about': 'bg-purple-100 text-purple-800',
      'contact': 'bg-orange-100 text-orange-800',
      'product': 'bg-green-100 text-green-800',
      'service': 'bg-teal-100 text-teal-800',
      'blog': 'bg-yellow-100 text-yellow-800',
      'team': 'bg-pink-100 text-pink-800',
      'pricing': 'bg-indigo-100 text-indigo-800',
    };
    
    const color = colorMap[type || 'page'] || 'bg-gray-100 text-gray-800';
    return (
      <Badge className={color} variant="secondary">
        {type || 'page'}
      </Badge>
    );
  };

  const getStatusBadge = (statusCode?: number) => {
    if (!statusCode) return <Badge variant="secondary">Unknown</Badge>;
    
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge className="bg-green-100 text-green-800">{statusCode} OK</Badge>;
    } else if (statusCode >= 300 && statusCode < 400) {
      return <Badge className="bg-yellow-100 text-yellow-800">{statusCode} Redirect</Badge>;
    } else if (statusCode >= 400) {
      return <Badge variant="destructive">{statusCode} Error</Badge>;
    }
    
    return <Badge variant="secondary">{statusCode}</Badge>;
  };

  const getAnalysisStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800">
            <Home className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <div className="animate-spin h-3 w-3 mr-1 border border-yellow-600 border-t-transparent rounded-full"></div>
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Queued
          </Badge>
        );
    }
  };

  const handleExportCsv = () => {
    window.open(`/api/analysis/${jobId}/export`, '_blank');
  };

  return (
    <div className="bg-card rounded-lg border border-border" data-testid="sitemap-table">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Discovered Pages</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground" data-testid="text-total-pages">
              {pages.length} of {totalPages} pages found
            </span>
            <Button
              size="sm"
              onClick={handleExportCsv}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Page URL</TableHead>
              <TableHead className="text-left">Title</TableHead>
              <TableHead className="text-left">Type</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="text-left">Analysis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentPages.map((page, index) => (
              <TableRow key={page.id} className="hover:bg-secondary/50" data-testid={`page-row-${index}`}>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {getPageTypeIcon(page.pageType || undefined)}
                    <span className="text-sm text-foreground truncate max-w-sm">
                      {page.url}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">
                    {page.title || 'No title'}
                  </span>
                </TableCell>
                <TableCell>
                  {getPageTypeBadge(page.pageType || undefined)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(page.statusCode || undefined)}
                </TableCell>
                <TableCell>
                  {getAnalysisStatusBadge(page.analysisStatus || 'pending')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {totalTablePages > 1 && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, pages.length)} of {pages.length} pages
            </span>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              {Array.from({ length: Math.min(5, totalTablePages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              
              {totalTablePages > 5 && (
                <>
                  <span className="text-sm text-muted-foreground px-2">...</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalTablePages)}
                    data-testid={`button-page-${totalTablePages}`}
                  >
                    {totalTablePages}
                  </Button>
                </>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalTablePages))}
                disabled={currentPage === totalTablePages}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
