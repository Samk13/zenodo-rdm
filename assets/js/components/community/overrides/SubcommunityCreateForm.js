import { i18next } from "@translations/invenio_communities/i18next";
import { Formik } from "formik";
import _get from "lodash/get";
import _isEmpty from "lodash/isEmpty";
import PropTypes from "prop-types";
import React, { Component } from "react";
import {
  CustomFields,
  FieldLabel,
  RadioField,
  SelectField,
  TextField,
  withCancel,
  RemoteSelectField,
  http,
} from "react-invenio-forms";
import { Button, Divider, Form, Grid, Header, Icon, Message } from "semantic-ui-react";
import { CommunityApi } from "@js/invenio_communities/api";
import { communityErrorSerializer } from "@js/invenio_communities/api/serializers";

class SubcommunityCreateForm extends Component {
  state = {
    error: "",
    hasCommunity: false,
    communities: [{ value: "Loading..." }],
  };

  componentDidMount() {
    withCancel(
      http
        .get("/api/user/communities?sort=newest")
        .then((response) => response.data)
        .then((data) => {
          this.setState({
            communities: data?.hits?.hits
              .filter((item) => !item?.parent?.id)
              .filter((item) => !item?.children?.allow === true)
              .map((item) => ({
                text: item.metadata.title,
                value: item.id,
                key: item.id,
              })),
          });
        })
        .catch((error) => {
          console.error(error);
        })
    );
  }

  componentWillUnmount() {
    this.cancellableCreate && this.cancellableCreate.cancel();
  }

  setGlobalError = (errorMsg) => {
    this.setState({ error: errorMsg });
  };

  onSubmit = async (values, { setSubmitting, setFieldError }) => {
    setSubmitting(true);
    const client = new CommunityApi();
    const { hasCommunity } = this.state;
    const { communityId } = this.props;
    let payload = {};
    let slug = "";
    let project = "";
    if (hasCommunity) {
      slug = values["metadata"]["community"];
      payload = { community_id: slug };
    } else {
      slug = values["metadata"]["slug"];
      project = values["metadata"]["project"];
      payload = {
        community: {
          title: values["metadata"]["title"],
          slug: slug,
          project: project,
        },
      };
    }
    this.cancellableCreate = withCancel(
      client.createSubcommunity(communityId, payload)
    );

    try {
      const response = await this.cancellableCreate.promise;
      setSubmitting(false);
      const requestID = response.data.id;
      // TODO It is computed for now because the link contains references to two different entities (request and community), and that's not supported yet by the backend.
      window.location.href = `/communities/${slug}/requests/${requestID}`;
    } catch (error) {
      if (error === "UNMOUNTED") return;

      const { errors, message } = communityErrorSerializer(error);

      if (message) {
        this.setGlobalError(message);
      }

      if (errors) {
        errors.map(({ field, messages }) => setFieldError(field, messages[0]));
      }
    }
  };

  render() {
    const { formConfig, canCreateRestricted, customFields, IdentifierField } =
      this.props;
    const { hasCommunity, communities, error } = this.state;

    return (
      <Formik
        initialValues={{
          access: {
            visibility: "public",
          },
          metadata: {
            slug: "",
          },
        }}
        onSubmit={this.onSubmit}
      >
        {({ values, isSubmitting, handleSubmit }) => (
          <Form onSubmit={handleSubmit} className="communities-creation">
            <Message hidden={error === ""} negative className="flashed">
              <Grid container centered>
                <Grid.Column mobile={16} tablet={12} computer={8} textAlign="left">
                  <strong>{error}</strong>
                </Grid.Column>
              </Grid>
            </Message>
            <Grid container centered>
              <Grid.Row>
                <Grid.Column mobile={16} tablet={12} computer={8} textAlign="center">
                  <Header as="h1" className="rel-mt-2">
                    {i18next.t("Subcommunity request")}
                  </Header>
                  <Divider />
                </Grid.Column>
              </Grid.Row>
              <Grid.Row textAlign="left">
                <Grid.Column mobile={16} tablet={12} computer={8}>
                  <div className="field">
                    <Form.Field>
                      {i18next.t("Do you already have an existing community?")}
                    </Form.Field>
                    <Form.Group>
                      <RadioField
                        label={i18next.t("Yes")}
                        checked={hasCommunity === true}
                        value={i18next.t("Yes")}
                        onChange={() => {
                          this.setState({ hasCommunity: true });
                        }}
                        fieldPath="metadata.hasCommunity"
                        disabled={_isEmpty(communities)}
                      />
                      <RadioField
                        label={i18next.t("No")}
                        checked={hasCommunity === false}
                        value={i18next.t("No")}
                        onChange={() => {
                          this.setState({ hasCommunity: false });
                        }}
                        fieldPath="metadata.hasCommunity"
                      />
                    </Form.Group>
                  </div>
                  {hasCommunity && (
                    <SelectField
                      label={
                        <FieldLabel
                          icon="user"
                          label={i18next.t("Community")}
                          id="community-label"
                          class="block"
                        />
                      }
                      fieldPath="metadata.community"
                      options={communities}
                      required
                      disabled={_isEmpty(communities)}
                    />
                  )}
                  {!hasCommunity && (
                    <>
                      <RemoteSelectField
                        fieldPath="metadata.project"
                        id="metadata.project"
                        suggestionAPIUrl="/api/awards?funders=00k4n6c32"
                        suggestionAPIHeaders={{
                          Accept: "application/vnd.inveniordm.v1+json",
                        }}
                        placeholder={i18next.t("Search for a project by name")}
                        serializeSuggestions={(suggestions) =>
                          suggestions.map((item) => ({
                            text: item.title_l10n,
                            content: (
                              <Header
                                content={`${item.title_l10n} - (${item.acronym})`}
                                subheader={item.number}
                              />
                            ),
                            value: item.id,
                            key: item.id,
                            acronym: item.acronym,
                          }))
                        }
                        label={
                          <FieldLabel
                            htmlFor="metadata.prokject"
                            icon="group"
                            label={i18next.t("Project")}
                          />
                        }
                        noQueryMessage={i18next.t("Search for project...")}
                        clearable
                        allowAdditions={false}
                        multiple={false}
                        selectOnBlur={false}
                        selectOnNavigation={false}
                        required
                        searchParamKey="q"
                        onValueChange={({ formikProps }, selectedSuggestions) => {
                          let selectedProject = selectedSuggestions[0];
                          if (selectedProject) {
                            formikProps.form.setFieldValue(
                              formikProps.fieldPath,
                              selectedProject.key
                            );
                            formikProps.form.setFieldValue(
                              "metadata.title",
                              selectedProject.text
                            );
                            if (selectedProject.acronym) {
                              formikProps.form.setFieldValue(
                                "metadata.slug",
                                selectedProject.acronym.toLowerCase()
                              );
                            }
                          } else {
                            formikProps.form.setFieldValue("metadata.project", "");
                            formikProps.form.setFieldValue("metadata.title", "");
                            formikProps.form.setFieldValue("metadata.slug", "");
                          }
                        }}
                      />
                      <TextField
                        required
                        id="metadata.title"
                        fluid
                        fieldPath="metadata.title"
                        // Prevent submitting before the value is updated:
                        onKeyDown={(e) => {
                          e.key === "Enter" && e.preventDefault();
                        }}
                        label={
                          <FieldLabel
                            htmlFor="metadata.title"
                            icon="book"
                            label={i18next.t("Community name")}
                          />
                        }
                      />
                      <IdentifierField formConfig={formConfig} />
                    </>
                  )}
                  {!_isEmpty(customFields.ui) && (
                    <CustomFields
                      config={customFields.ui}
                      templateLoaders={[
                        (widget) => import(`@templates/custom_fields/${widget}.js`),
                        (widget) => import(`react-invenio-forms`),
                      ]}
                      fieldPathPrefix="custom_fields"
                    />
                  )}
                  {canCreateRestricted && (
                    <>
                      <Header as="h3">{i18next.t("Community visibility")}</Header>
                      {formConfig.access.visibility.map((item) => (
                        <React.Fragment key={item.value}>
                          <RadioField
                            key={item.value}
                            fieldPath="access.visibility"
                            label={item.text}
                            labelIcon={item.icon}
                            checked={_get(values, "access.visibility") === item.value}
                            value={item.value}
                            onChange={({ event, data, formikProps }) => {
                              formikProps.form.setFieldValue(
                                "access.visibility",
                                item.value
                              );
                            }}
                          />
                          <label className="helptext">{item.helpText}</label>
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </Grid.Column>
              </Grid.Row>
              <Grid.Row>
                <Grid.Column textAlign="center">
                  <Button
                    positive
                    icon
                    labelPosition="left"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    type="button"
                    onClick={(event) => handleSubmit(event)}
                  >
                    <Icon name="plus" />
                    {hasCommunity
                      ? i18next.t("Create request")
                      : i18next.t("Create community")}
                  </Button>
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Form>
        )}
      </Formik>
    );
  }
}

SubcommunityCreateForm.propTypes = {
  formConfig: PropTypes.object.isRequired,
  canCreateRestricted: PropTypes.bool.isRequired,
  communityId: PropTypes.string.isRequired,
  customFields: PropTypes.object,
  IdentifierField: PropTypes.func,
};

export default SubcommunityCreateForm;
