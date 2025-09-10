import { Badge } from "@/components/ui/badge";

interface DetectedTechnology {
  name: string;
  version?: string;
  category: string;
  confidence: number;
}

interface TechnologyResultsProps {
  technologies: DetectedTechnology[];
}

export default function TechnologyResults({ technologies }: TechnologyResultsProps) {
  const getTechnologyIcon = (name: string) => {
    const iconMap: Record<string, string> = {
      'WordPress': 'fab fa-wordpress text-blue-600',
      'Shopify': 'fas fa-shopping-cart text-green-600',
      'React': 'fab fa-react text-blue-500',
      'Vue.js': 'fab fa-vuejs text-green-500',
      'Angular': 'fab fa-angular text-red-600',
      'PHP': 'fab fa-php text-purple-600',
      'Google Analytics': 'fab fa-google text-red-500',
      'jQuery': 'fab fa-js text-yellow-600',
      'Bootstrap': 'fab fa-bootstrap text-purple-600',
      'Nginx': 'fas fa-server text-green-600',
      'Apache': 'fas fa-server text-red-600',
    };
    
    return iconMap[name] || 'fas fa-code text-gray-600';
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'CMS': 'bg-blue-100 text-blue-800',
      'E-commerce': 'bg-green-100 text-green-800',
      'JavaScript Framework': 'bg-purple-100 text-purple-800',
      'Programming Language': 'bg-orange-100 text-orange-800',
      'Analytics': 'bg-red-100 text-red-800',
      'JavaScript Library': 'bg-yellow-100 text-yellow-800',
      'CSS Framework': 'bg-pink-100 text-pink-800',
      'Web Server': 'bg-gray-100 text-gray-800',
    };
    
    return colorMap[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6" data-testid="technology-results">
      <h3 className="text-lg font-medium text-foreground mb-4">Technology Stack Detected</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {technologies.map((tech, index) => (
          <div key={index} className="p-4 bg-secondary rounded-lg" data-testid={`tech-card-${index}`}>
            <div className="flex items-center space-x-3 mb-2">
              <i className={`${getTechnologyIcon(tech.name)} text-xl`}></i>
              <span className="font-medium text-foreground">{tech.name}</span>
            </div>
            {tech.version && (
              <p className="text-sm text-muted-foreground mb-1">Version {tech.version}</p>
            )}
            <div className="flex items-center justify-between">
              <Badge className={getCategoryColor(tech.category)} variant="secondary">
                {tech.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {Math.round(tech.confidence * 100)}% confidence
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
