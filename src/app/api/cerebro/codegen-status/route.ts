import { NextRequest, NextResponse } from "next/server";

import { authHeadersFor, buildCerebroUrl, fetchCerebro, proxyFetchError } from "@/lib/cerebro-proxy";
import { isCerebroFixtureMode } from "@/lib/cerebro-fixtures";

export async function GET(request: NextRequest) {
  if (isCerebroFixtureMode()) {
    return NextResponse.json(defaultCodegenStatus());
  }

  let response: Response;
  try {
    response = await fetchCerebro(buildCerebroUrl("connector-catalog/analysis"), {
      cache: "no-store",
      headers: authHeadersFor(request),
    });
  } catch (error) {
    return proxyFetchError(error);
  }

  if (!response.ok) {
    // Return a placeholder status when the backend endpoint is not available.
    return NextResponse.json(defaultCodegenStatus());
  }

  const analysis = await response.json();

  return NextResponse.json({
    catalog: {
      total: analysis?.summary?.total ?? 0,
      catalog_ready: analysis?.summary?.catalog_ready ?? 0,
      generateable: analysis?.summary?.generateable ?? 0,
      needs_auth_extension: analysis?.summary?.needs_auth_extension ?? 0,
      needs_bespoke_runtime: analysis?.summary?.needs_bespoke_runtime ?? 0,
      by_auth_model: analysis?.summary?.by_auth_model ?? {},
      by_classifier_output: analysis?.summary?.by_classifier_output ?? {},
      issues: analysis?.issues?.length ?? 0,
    },
    projection_templates: {
      count: 16,
      templates: [
        "alert", "asset", "audit_event", "cloud_resource", "compliance_control",
        "deployment", "endpoint_device", "evidence_cas_reference", "finding",
        "group_membership", "identity_group", "identity_user", "policy",
        "repository", "secret", "vulnerability",
      ],
    },
    generators: defaultGenerators(),
  });
}

function defaultCodegenStatus() {
  return {
    catalog: null,
    projection_templates: null,
    generators: defaultGenerators(),
  };
}

function defaultGenerators() {
  return [
    { name: "Proto/ConnectRPC", tool: "buf generate", make_target: "proto-generate", check_target: "proto-generate-check", description: "Protobuf-derived Go, ConnectRPC, and Python stubs" },
    { name: "OpenAPI TypeScript Types", tool: "tools/openapitsgen", make_target: "openapi-ts-generate", check_target: "openapi-ts-check", description: "TypeScript type definitions from api/openapi.yaml" },
    { name: "Source Runtime SDK", tool: "internal/sourcegen", make_target: "sourcegen-check", check_target: "sourcegen-check", description: "Generated source packages from connector definitions" },
    { name: "Graph Action Registry", tool: "tools/graphactiongen", make_target: "graph-action-generate", check_target: "graph-action-check", description: "Graph action registry from action_catalog.yaml" },
    { name: "Policy Rule Catalog", tool: "tools/policyrulegen", make_target: "policy-rule-generate", check_target: "policy-rule-check", description: "Policy rule catalog from DSL YAML + extensions" },
    { name: "Detection Catalog", tool: "tools/detectioncatalog", make_target: "detection-catalog-generate", check_target: "detection-catalog-check", description: "Public detection catalog from internal rule definitions" },
    { name: "Finding DSL Schema", tool: "tools/findingdsl", make_target: "finding-dsl-schema-generate", check_target: "finding-dsl-schema-check", description: "JSON Schema for PolicyFindingRule YAML validation" },
    { name: "Control Index", tool: "tools/controlindex", make_target: "control-index-generate", check_target: "control-index-check", description: "Control framework index from control families" },
    { name: "OpenAPI Route Parity", tool: "scripts/openapi_route_parity.go", make_target: "openapi-sync", check_target: "openapi-check", description: "OpenAPI spec route parity with implementation" },
    { name: "Connector Onboard", tool: "tools/connectoronboard", make_target: "connector-onboard", check_target: "", description: "End-to-end connector onboarding from OpenAPI spec" },
  ];
}
